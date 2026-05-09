import { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate, type Database as DbInterface } from '@kay-am/db';
import type { TaskId, WorkspaceId } from '@kay-am/types';
import { ContextEngine } from '../context/engine';
import { SLOT_KEYS } from '../context/slots';
import { Summarizer } from './cli';

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

async function seedSession(db: DbInterface, taskId: TaskId): Promise<void> {
  const workspaceId = 'ws_round' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', '/tmp/demo', 0, 0],
  );
  await db.execute(
    `INSERT INTO tasks
       (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [taskId, workspaceId, 'demo', 'idle', '{"lastActivityAt":"2026-05-07T00:00:00Z"}', 0, 0],
  );
}

function makeMockSpawnWithOutput(text: string): typeof import('node:child_process').spawn {
  return vi.fn().mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: Readable;
      stderr: Readable;
      killed: boolean;
      exitCode: number | null;
      kill: () => boolean;
    };
    child.stdout = new Readable({ read() {} });
    child.stderr = new Readable({ read() {} });
    child.killed = false;
    child.exitCode = null;
    child.kill = () => true;
    setImmediate(() => {
      child.stdout.push(text);
      child.stdout.push(null);
      child.stderr.push(null);
      setImmediate(() => child.emit('close', 0));
    });
    return child as unknown as ChildProcess;
  }) as unknown as typeof import('node:child_process').spawn;
}

async function applyDelta(
  engine: ContextEngine,
  taskId: TaskId,
  upserts: ReadonlyArray<{ key: string; value: string }>,
): Promise<void> {
  for (const upsert of upserts) {
    await engine.upsert(taskId, upsert.key, upsert.value);
  }
}

describe('synthetic context engine round-trip', () => {
  it('all 5 slots empty → summarizer fills them all', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_empty' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    const fakeUpserts = SLOT_KEYS.map((key) => ({ key, value: `seeded ${key}` }));
    const spawnFn = makeMockSpawnWithOutput(JSON.stringify({ upserts: fakeUpserts }));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const before = await engine.load(taskId);
    expect(before).toHaveLength(0);

    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'kick off',
      turnOutput: 'ack',
    });
    await applyDelta(engine, taskId, result.delta.upserts);

    const after = await engine.load(taskId);
    expect(after.map((s) => s.key).sort()).toEqual([...SLOT_KEYS].sort());
    for (const slot of after) {
      expect(slot.value).toBe(`seeded ${slot.key}`);
    }
  });

  it('partial state → summarizer updates some, leaves others alone', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_partial' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    await engine.upsert(taskId, 'goal', 'original goal');
    await engine.upsert(taskId, 'decisions', 'original decision');

    const spawnFn = makeMockSpawnWithOutput(
      JSON.stringify({
        upserts: [
          { key: 'goal', value: 'updated goal' },
          { key: 'open_questions', value: 'how to test?' },
        ],
      }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const before = await engine.load(taskId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'q',
      turnOutput: 'a',
    });
    await applyDelta(engine, taskId, result.delta.upserts);

    const after = await engine.load(taskId);
    const byKey = new Map(after.map((s) => [s.key, s.value]));
    expect(byKey.get('goal')).toBe('updated goal');
    expect(byKey.get('decisions')).toBe('original decision');
    expect(byKey.get('open_questions')).toBe('how to test?');
  });

  it('full state → empty delta keeps slots untouched', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_full' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    for (const key of SLOT_KEYS) {
      await engine.upsert(taskId, key, `pre-${key}`);
    }

    const spawnFn = makeMockSpawnWithOutput(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const before = await engine.load(taskId);
    const result = await summarizer.summarize({
      prevSlots: before,
      turnInput: 'noop',
      turnOutput: 'noop',
    });
    expect(result.delta.upserts).toEqual([]);
    await applyDelta(engine, taskId, result.delta.upserts);

    const after = await engine.load(taskId);
    expect(after.map((s) => s.value).sort()).toEqual(SLOT_KEYS.map((k) => `pre-${k}`).sort());
  });

  it('preserves stable keys (no key drift after multiple round-trips)', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_drift' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    for (let i = 0; i < 5; i += 1) {
      const spawnFn = makeMockSpawnWithOutput(
        JSON.stringify({ upserts: [{ key: 'goal', value: `iteration ${i}` }] }),
      );
      const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });
      const slots = await engine.load(taskId);
      const result = await summarizer.summarize({
        prevSlots: slots,
        turnInput: `q${i}`,
        turnOutput: `a${i}`,
      });
      await applyDelta(engine, taskId, result.delta.upserts);
    }

    const after = await engine.load(taskId);
    expect(after).toHaveLength(1);
    expect(after[0]?.key).toBe('goal');
    expect(after[0]?.value).toBe('iteration 4');
  });

  it('handles oversize values without truncation', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_huge' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    const huge = 'x'.repeat(50_000);
    const spawnFn = makeMockSpawnWithOutput(
      JSON.stringify({ upserts: [{ key: 'last_output_summary', value: huge }] }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'q',
      turnOutput: 'a',
    });
    await applyDelta(engine, taskId, result.delta.upserts);

    const after = await engine.load(taskId);
    const slot = after.find((s) => s.key === 'last_output_summary');
    expect(slot?.value.length).toBe(50_000);
  });

  it('drops summarizer-suggested keys outside the known set', async () => {
    const db = makeDb();
    await migrate(db);
    const taskId = 'sess_unknown_key' as TaskId;
    await seedSession(db, taskId);
    const engine = new ContextEngine({ db });

    const spawnFn = makeMockSpawnWithOutput(
      JSON.stringify({
        upserts: [
          { key: 'goal', value: 'ok' },
          { key: 'mystery_slot', value: 'should be dropped' },
        ],
      }),
    );
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'q',
      turnOutput: 'a',
    });

    expect(result.delta.upserts.map((u) => u.key)).toEqual(['goal']);
    await applyDelta(engine, taskId, result.delta.upserts);

    const after = await engine.load(taskId);
    expect(after.map((s) => s.key)).toEqual(['goal']);
  });
});
