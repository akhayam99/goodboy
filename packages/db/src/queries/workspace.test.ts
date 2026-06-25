import { describe, expect, it } from 'vitest'
import type { IsoDateTime, WorkspaceId } from '@goodboy/types'
import { makeTestDatabase } from '../test-helpers/test-db'
import { migrate } from '../migrations/runner'
import {
  deleteWorkspace,
  disconnectWorkspace,
  findWorkspaceByRootPath,
  getWorkspaceById,
  insertWorkspace,
  listWorkspaces,
  reconnectWorkspace,
  touchWorkspaceLastAccessed,
} from './workspace'

const iso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime

async function makeDb() {
  const db = makeTestDatabase()
  await migrate(db)
  return db
}

function makeWorkspace(
  overrides: Partial<{
    id: string
    name: string
    rootPath: string
    lastAccessedAt?: IsoDateTime
  }> = {},
) {
  const now = iso(Date.now())
  return {
    id: (overrides.id ?? 'w1') as WorkspaceId,
    name: overrides.name ?? 'my-repo',
    rootPath: overrides.rootPath ?? '/tmp/my-repo',
    createdAt: now,
    updatedAt: now,
    ...(overrides.lastAccessedAt != null ? { lastAccessedAt: overrides.lastAccessedAt } : {}),
  }
}

describe('insertWorkspace', () => {
  it('round-trips all fields', async () => {
    const db = await makeDb()
    const ws = makeWorkspace({ lastAccessedAt: iso(Date.now()) })
    await insertWorkspace(db, ws)
    const row = await getWorkspaceById(db, ws.id)
    expect(row).not.toBeNull()
    expect(row?.name).toBe(ws.name)
    expect(row?.rootPath).toBe(ws.rootPath)
    expect(row?.lastAccessedAt).toBeTruthy()
  })

  it('stores lastAccessedAt when provided', async () => {
    const db = await makeDb()
    const t = iso(1_700_000_000_000)
    const ws = makeWorkspace({ lastAccessedAt: t })
    await insertWorkspace(db, ws)
    const row = await getWorkspaceById(db, ws.id)
    expect(row?.lastAccessedAt).toBeDefined()
    expect(Date.parse(row!.lastAccessedAt!)).toBeCloseTo(Date.parse(t), -2)
  })

  it('falls back to updatedAt when lastAccessedAt absent', async () => {
    const db = await makeDb()
    const ws = makeWorkspace()
    await insertWorkspace(db, ws)
    const row = await getWorkspaceById(db, ws.id)
    expect(row?.lastAccessedAt).toBeDefined()
    expect(Date.parse(row!.lastAccessedAt!)).toBeCloseTo(Date.parse(ws.updatedAt), -2)
  })
})

describe('listWorkspaces', () => {
  it('returns only active workspaces', async () => {
    const db = await makeDb()
    const active = makeWorkspace({ id: 'active', rootPath: '/tmp/active' })
    const disconnected = makeWorkspace({ id: 'dead', rootPath: '/tmp/dead' })
    await insertWorkspace(db, active)
    await insertWorkspace(db, disconnected)
    await disconnectWorkspace(db, 'dead' as WorkspaceId, iso(Date.now()))
    const list = await listWorkspaces(db)
    expect(list.map((w) => w.id)).toEqual(['active'])
  })

  it('returns empty array when none exist', async () => {
    const db = await makeDb()
    expect(await listWorkspaces(db)).toEqual([])
  })
})

describe('findWorkspaceByRootPath', () => {
  it('finds active workspace by path', async () => {
    const db = await makeDb()
    const ws = makeWorkspace({ rootPath: '/projects/foo' })
    await insertWorkspace(db, ws)
    const found = await findWorkspaceByRootPath(db, '/projects/foo')
    expect(found?.id).toBe(ws.id)
  })

  it('finds disconnected workspace by path', async () => {
    const db = await makeDb()
    const ws = makeWorkspace({ rootPath: '/projects/old' })
    await insertWorkspace(db, ws)
    await disconnectWorkspace(db, ws.id, iso(Date.now()))
    const found = await findWorkspaceByRootPath(db, '/projects/old')
    expect(found?.id).toBe(ws.id)
    expect(found?.disconnectedAt).toBeDefined()
  })

  it('returns null for unknown path', async () => {
    const db = await makeDb()
    expect(await findWorkspaceByRootPath(db, '/nonexistent')).toBeNull()
  })
})

describe('touchWorkspaceLastAccessed', () => {
  it('updates last_accessed_at to now', async () => {
    const db = await makeDb()
    const old = iso(Date.now() - 1_000_000)
    const ws = makeWorkspace({ lastAccessedAt: old })
    await insertWorkspace(db, ws)

    const before = Date.now()
    await touchWorkspaceLastAccessed(db, ws.id)
    const after = Date.now()

    const row = await getWorkspaceById(db, ws.id)
    const accessed = Date.parse(row!.lastAccessedAt!)
    expect(accessed).toBeGreaterThanOrEqual(before)
    expect(accessed).toBeLessThanOrEqual(after)
  })

  it('is idempotent — second touch advances timestamp', async () => {
    const db = await makeDb()
    const ws = makeWorkspace({ lastAccessedAt: iso(1_000_000) })
    await insertWorkspace(db, ws)
    await touchWorkspaceLastAccessed(db, ws.id)
    const first = Date.parse((await getWorkspaceById(db, ws.id))!.lastAccessedAt!)
    await touchWorkspaceLastAccessed(db, ws.id)
    const second = Date.parse((await getWorkspaceById(db, ws.id))!.lastAccessedAt!)
    expect(second).toBeGreaterThanOrEqual(first)
  })
})

describe('disconnectWorkspace / reconnectWorkspace', () => {
  it('soft-deletes: row stays, disconnectedAt set', async () => {
    const db = await makeDb()
    const ws = makeWorkspace()
    await insertWorkspace(db, ws)
    const at = iso(Date.now())
    await disconnectWorkspace(db, ws.id, at)

    const row = await getWorkspaceById(db, ws.id)
    expect(row?.disconnectedAt).toBeDefined()
    const list = await listWorkspaces(db)
    expect(list).toHaveLength(0)
  })

  it('reconnect clears disconnectedAt and updates lastAccessedAt', async () => {
    const db = await makeDb()
    const ws = makeWorkspace()
    await insertWorkspace(db, ws)
    await disconnectWorkspace(db, ws.id, iso(Date.now() - 5000))

    const reconnectAt = iso(Date.now())
    await reconnectWorkspace(db, ws.id, reconnectAt)

    const row = await getWorkspaceById(db, ws.id)
    expect(row?.disconnectedAt).toBeUndefined()
    expect(Date.parse(row!.lastAccessedAt!)).toBeCloseTo(Date.parse(reconnectAt), -2)

    const list = await listWorkspaces(db)
    expect(list).toHaveLength(1)
  })

  it('reconnecting a workspace that was never disconnected does not set disconnectedAt', async () => {
    const db = await makeDb()
    const ws = makeWorkspace()
    await insertWorkspace(db, ws)
    await reconnectWorkspace(db, ws.id, iso(Date.now()))
    const row = await getWorkspaceById(db, ws.id)
    expect(row?.disconnectedAt).toBeUndefined()
  })
})

describe('deleteWorkspace', () => {
  it('hard-deletes the row', async () => {
    const db = await makeDb()
    const ws = makeWorkspace()
    await insertWorkspace(db, ws)
    await deleteWorkspace(db, ws.id)
    expect(await getWorkspaceById(db, ws.id)).toBeNull()
  })
})

describe('duplicate path guard', () => {
  it('inserting same rootPath twice throws a unique constraint', async () => {
    const db = await makeDb()
    const ws1 = makeWorkspace({ id: 'dup1', rootPath: '/dup' })
    const ws2 = makeWorkspace({ id: 'dup2', rootPath: '/dup' })
    await insertWorkspace(db, ws1)
    await expect(insertWorkspace(db, ws2)).rejects.toThrow()
  })
})
