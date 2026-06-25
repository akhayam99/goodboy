import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrate, type Database as DbInterface } from '@goodboy/db'
import type { SessionId, WorkspaceId } from '@goodboy/types'
import { ContextEngine } from './engine'
import { InvalidSlotKeyError, serializeSlots, SLOT_KEYS } from './slots'

function makeDb(): DbInterface {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return {
    async exec(sql) {
      db.exec(sql)
    },
    async execute(sql, params = []) {
      const stmt = db.prepare(sql)
      const result = stmt.run(...(params as ReadonlyArray<never>))
      return { rowsAffected: result.changes }
    },
    async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const stmt = db.prepare(sql)
      return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>
    },
  }
}

async function seedSession(db: DbInterface, sessionId: SessionId): Promise<void> {
  const workspaceId = 'ws_ctx' as WorkspaceId
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', '/tmp/demo', 0, 0],
  )
  await db.execute(
    `INSERT INTO sessions
       (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', '{"lastActivityAt":"2026-05-07T00:00:00Z"}', 0, 0],
  )
}

describe('serializeSlots', () => {
  it('emits every slot key with placeholder when missing', () => {
    const out = serializeSlots([])
    for (const key of SLOT_KEYS) {
      expect(out).toContain(`## ${key.replace(/_/g, ' ')}`)
    }
    expect(out.split('·').length - 1).toBe(SLOT_KEYS.length)
  })

  it('uses provided value when present', () => {
    const out = serializeSlots([{ key: 'goal', value: 'refactor auth', enabled: true }])
    expect(out).toMatch(/## goal\nrefactor auth/)
  })

  it('order is stable regardless of input order', () => {
    const a = serializeSlots([
      { key: 'decisions', value: 'd', enabled: true },
      { key: 'goal', value: 'g', enabled: true },
    ])
    const b = serializeSlots([
      { key: 'goal', value: 'g', enabled: true },
      { key: 'decisions', value: 'd', enabled: true },
    ])
    expect(a).toBe(b)
  })

  it('serializes slots regardless of the legacy enabled flag', () => {
    const out = serializeSlots([{ key: 'goal', value: 'visible-anyway', enabled: false }])
    expect(out).toContain('visible-anyway')
  })
})

describe('ContextEngine', () => {
  it('rejects unknown slot keys', async () => {
    const db = makeDb()
    await migrate(db)
    await seedSession(db, 'sess_1' as SessionId)
    const engine = new ContextEngine({ db })

    await expect(engine.upsert('sess_1' as SessionId, 'unknown', 'x')).rejects.toBeInstanceOf(
      InvalidSlotKeyError,
    )
  })

  it('round-trips slots through the db', async () => {
    const db = makeDb()
    await migrate(db)
    await seedSession(db, 'sess_2' as SessionId)
    const engine = new ContextEngine({ db })

    await engine.upsert('sess_2' as SessionId, 'goal', 'ship v0.1')
    await engine.upsert('sess_2' as SessionId, 'decisions', 'use claude only')
    await engine.upsert('sess_2' as SessionId, 'goal', 'ship v0.1 quickly')

    const slots = await engine.load('sess_2' as SessionId)
    const goal = slots.find((s) => s.key === 'goal')
    const decisions = slots.find((s) => s.key === 'decisions')
    expect(goal?.value).toBe('ship v0.1 quickly')
    expect(decisions?.value).toBe('use claude only')

    const serialized = await engine.serialize('sess_2' as SessionId)
    expect(serialized).toContain('ship v0.1 quickly')
    expect(serialized).toContain('use claude only')
  })

  it('keeps slot content visible even when enabled is toggled off (legacy flag is a no-op)', async () => {
    const db = makeDb()
    await migrate(db)
    await seedSession(db, 'sess_3' as SessionId)
    const engine = new ContextEngine({ db })

    await engine.upsert('sess_3' as SessionId, 'goal', 'visible')
    await engine.setEnabled('sess_3' as SessionId, 'goal', false)

    const out = await engine.serialize('sess_3' as SessionId)
    expect(out).toContain('visible')
  })
})
