import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate, type Database as DbInterface } from '@kay-am/db';
import type { SessionId, WorkspaceId } from '@kay-am/types';
import { ContextEngine } from '../context/engine';
import { SLOT_KEYS } from '../context/slots';
import { HAIKU_MODEL, Summarizer } from './client';

function makeDb(): DbInterface {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async execute(sql, params = []) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...(params as ReadonlyArray<never>));
      return { rowsAffected: result.changes };
    },
    async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
    },
  };
}

async function seedSession(db: DbInterface, sessionId: SessionId): Promise<void> {
  const workspaceId = 'ws_round' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', '/tmp/demo', 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions
       (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', '{"lastActivityAt":"2026-05-07T00:00:00Z"}', 0, 0],
  );
}

function fakeAnthropicReply(upserts: ReadonlyArray<{ key: string; value: string }>) {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ upserts }) }],
      usage: { input_tokens: 100, output_tokens: 20 },
      model: HAIKU_MODEL,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

async function applyDelta(
  engine: ContextEngine,
  sessionId: SessionId,
  upserts: ReadonlyArray<{ key: string; value: string }>,
): Promise<void> {
  for (const upsert of upserts) {
    await engine.upsert(sessionId, upsert.key, upsert.value);
  }
}

describe('synthetic context engine round-trip', () => {
  it('all 5 slots empty → summarizer fills them all', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_empty' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const fakeUpserts = SLOT_KEYS.map((key) => ({ key, value: `seeded ${key}` }));
    const fetchFn = vi.fn<typeof fetch>(async () => fakeAnthropicReply(fakeUpserts));
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const before = await engine.load(sessionId);
    expect(before).toHaveLength(0);

    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'kick off',
      turnOutput: 'ack',
    });
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    expect(after.map((s) => s.key).sort()).toEqual([...SLOT_KEYS].sort());
    for (const slot of after) {
      expect(slot.value).toBe(`seeded ${slot.key}`);
    }
  });

  it('partial state → summarizer updates some, leaves others alone', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_partial' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    await engine.upsert(sessionId, 'goal', 'original goal');
    await engine.upsert(sessionId, 'decisions', 'original decision');

    const fetchFn = vi.fn<typeof fetch>(async () =>
      fakeAnthropicReply([
        { key: 'goal', value: 'updated goal' },
        { key: 'open_questions', value: 'how to test?' },
      ]),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const before = await engine.load(sessionId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'q',
      turnOutput: 'a',
    });
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    const byKey = new Map(after.map((s) => [s.key, s.value]));
    expect(byKey.get('goal')).toBe('updated goal');
    expect(byKey.get('decisions')).toBe('original decision');
    expect(byKey.get('open_questions')).toBe('how to test?');
  });

  it('full state → empty delta keeps slots untouched', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_full' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    for (const key of SLOT_KEYS) {
      await engine.upsert(sessionId, key, `pre-${key}`);
    }

    const fetchFn = vi.fn<typeof fetch>(async () => fakeAnthropicReply([]));
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const before = await engine.load(sessionId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'noop',
      turnOutput: 'noop',
    });
    expect(result.delta.upserts).toEqual([]);
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    expect(after.map((s) => s.value).sort()).toEqual(SLOT_KEYS.map((k) => `pre-${k}`).sort());
  });

  it('preserves stable keys (no key drift after multiple round-trips)', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_drift' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const summarizerWith = (upserts: ReadonlyArray<{ key: string; value: string }>) => {
      const fetchFn = vi.fn<typeof fetch>(async () => fakeAnthropicReply(upserts));
      return new Summarizer({ apiKey: 'sk', fetchFn });
    };

    for (let i = 0; i < 5; i += 1) {
      const summarizer = summarizerWith([{ key: 'goal', value: `iteration ${i}` }]);
      const slots = await engine.load(sessionId);
      const result = await summarizer.summarize({
        prevSlots: slots,
        turnInput: `q${i}`,
        turnOutput: `a${i}`,
      });
      await applyDelta(engine, sessionId, result.delta.upserts);
    }

    const after = await engine.load(sessionId);
    expect(after).toHaveLength(1);
    expect(after[0]?.key).toBe('goal');
    expect(after[0]?.value).toBe('iteration 4');
  });

  it('handles oversize values without truncation', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_huge' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const huge = 'x'.repeat(50_000);
    const fetchFn = vi.fn<typeof fetch>(async () =>
      fakeAnthropicReply([{ key: 'last_output_summary', value: huge }]),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'q',
      turnOutput: 'a',
    });
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    const slot = after.find((s) => s.key === 'last_output_summary');
    expect(slot?.value.length).toBe(50_000);
  });

  it('drops summarizer-suggested keys outside the known set', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_unknown_key' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const fetchFn = vi.fn<typeof fetch>(async () =>
      fakeAnthropicReply([
        { key: 'goal', value: 'ok' },
        { key: 'mystery_slot', value: 'should be dropped' },
      ]),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'q',
      turnOutput: 'a',
    });

    expect(result.delta.upserts.map((u) => u.key)).toEqual(['goal']);
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    expect(after.map((s) => s.key)).toEqual(['goal']);
  });
});
