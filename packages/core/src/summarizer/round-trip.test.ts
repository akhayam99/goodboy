import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, type Database as DbInterface } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ContextEngine } from '../context/engine';
import { SLOT_KEYS, SLOT_LABELS } from '../context/slots';
import { Summarizer, type SummarizerDeps } from './client';

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
       (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', Date.parse('2026-05-07T00:00:00Z'), 0, 0],
  );
}

const makeInvokeFnWithOutput = (text: string): SummarizerDeps['invokeFn'] => {
  return async <T>(): Promise<T> => {
    return { stdout: text, stderr: '', exitCode: 0 } as T;
  };
};

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
    const invokeFn = makeInvokeFnWithOutput(JSON.stringify({ upserts: fakeUpserts }));
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

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
    const serialized = await engine.serialize(sessionId);
    expect(serialized).toContain(`## ${SLOT_LABELS.last_output_summary}`);
  });

  it('partial state → summarizer updates some, leaves others alone', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_partial' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    await engine.upsert(sessionId, 'goal', 'original goal');
    await engine.upsert(sessionId, 'decisions', 'original decision');

    const invokeFn = makeInvokeFnWithOutput(
      JSON.stringify({
        upserts: [
          { key: 'goal', value: 'updated goal' },
          { key: 'open_questions', value: 'how to test?' },
        ],
      }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

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

    const invokeFn = makeInvokeFnWithOutput(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

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

    for (let i = 0; i < 5; i += 1) {
      const invokeFn = makeInvokeFnWithOutput(
        JSON.stringify({ upserts: [{ key: 'goal', value: `iteration ${i}` }] }),
      );
      const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });
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
    const invokeFn = makeInvokeFnWithOutput(
      JSON.stringify({ upserts: [{ key: 'last_output_summary', value: huge }] }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

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

  it('preserves the four-section structure of last_output_summary across a rewrite', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_structured' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const prev = [
      '#### Problem',
      'auth middleware rejects valid tokens.',
      '',
      '#### Learned',
      '- clock skew between issuer and verifier.',
      '',
      '#### State',
      '- patch drafted.',
      '',
      '#### Next',
      '- add regression test.',
    ].join('\n');
    await engine.upsert(sessionId, 'last_output_summary', prev);

    const merged = [
      '#### Problem',
      'auth middleware rejects valid tokens.',
      '',
      '#### Learned',
      '- clock skew between issuer and verifier; tolerance now configurable.',
      '',
      '#### State',
      '- patch merged, regression test green.',
      '',
      '#### Next',
      '- monitor staging for false rejects.',
    ].join('\n');
    const invokeFn = makeInvokeFnWithOutput(
      JSON.stringify({ upserts: [{ key: 'last_output_summary', value: merged }] }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

    const before = await engine.load(sessionId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'ship it',
      turnOutput: 'merged and tested',
    });
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    const value = after.find((s) => s.key === 'last_output_summary')?.value ?? '';
    expect(value).toContain('#### Problem\nauth middleware rejects valid tokens.');
    expect(value).toContain('#### Learned');
    expect(value).toContain('#### State\n- patch merged, regression test green.');
    expect(value).toContain('#### Next\n- monitor staging for false rejects.');
    expect(value.indexOf('#### Problem')).toBeLessThan(value.indexOf('#### Learned'));
    expect(value.indexOf('#### Learned')).toBeLessThan(value.indexOf('#### State'));
    expect(value.indexOf('#### State')).toBeLessThan(value.indexOf('#### Next'));
  });

  it('replaces decisions with the consolidated full set', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_decisions' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const raw = [
      '- use jwt for auth',
      '- use jwt tokens for authentication',
      '- store refresh token in sqlite',
      '- do not store refresh token in sqlite',
    ].join('\n');
    await engine.upsert(sessionId, 'decisions', raw);

    const consolidated = ['- use jwt for auth', '- keep refresh token in memory only'].join('\n');
    const invokeFn = makeInvokeFnWithOutput(
      JSON.stringify({ upserts: [{ key: 'decisions', value: consolidated }] }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

    const before = await engine.load(sessionId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'consolidate decisions',
      turnOutput: 'done',
    });
    await applyDelta(engine, sessionId, result.delta.upserts);

    const after = await engine.load(sessionId);
    const value = after.find((s) => s.key === 'decisions')?.value ?? '';
    expect(value).toBe(consolidated);
    expect(value).not.toContain('use jwt tokens for authentication');
    expect(value).not.toContain('store refresh token in sqlite');
  });

  it('drops summarizer-suggested keys outside the known set', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'sess_unknown_key' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });

    const invokeFn = makeInvokeFnWithOutput(
      JSON.stringify({
        upserts: [
          { key: 'goal', value: 'ok' },
          { key: 'mystery_slot', value: 'should be dropped' },
        ],
      }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

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
