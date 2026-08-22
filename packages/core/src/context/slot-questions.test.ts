import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, type Database as DbInterface } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ContextEngine } from './engine';
import { addQuestionsToSlot, removeQuestionsFromSlot } from './slot-questions';

function makeDb(): DbInterface {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async execute(sql, params = []) {
      const result = db.prepare(sql).run(...(params as ReadonlyArray<never>));
      return { rowsAffected: result.changes };
    },
    async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      return db
        .prepare(sql)
        .all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
    },
  };
}

async function seed(db: DbInterface, sessionId: SessionId): Promise<void> {
  const workspaceId = 'ws_sq' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', '/tmp/demo', 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', 0, 0, 0],
  );
}

describe('slot question helpers', () => {
  it('removes a matching line from the open_questions slot', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_sq_1' as SessionId;
    await seed(db, sessionId);
    const engine = new ContextEngine({ db });
    await engine.upsert(sessionId, 'open_questions', 'keep this one\ndrop this one');

    const changed = await removeQuestionsFromSlot(db, sessionId, ['drop this one']);

    expect(changed).toBe(true);
    const slots = await engine.load(sessionId);
    expect(slots.find((s) => s.key === 'open_questions')?.value).toBe('keep this one');
  });

  it('is a no-op when nothing matches', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_sq_2' as SessionId;
    await seed(db, sessionId);
    const engine = new ContextEngine({ db });
    await engine.upsert(sessionId, 'open_questions', 'unrelated');

    expect(await removeQuestionsFromSlot(db, sessionId, ['nope'])).toBe(false);
  });

  it('re-adds a question to the slot, dedup against existing lines', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_sq_3' as SessionId;
    await seed(db, sessionId);
    const engine = new ContextEngine({ db });
    await engine.upsert(sessionId, 'open_questions', 'first');

    expect(await addQuestionsToSlot(db, sessionId, ['second'])).toBe(true);
    expect(await addQuestionsToSlot(db, sessionId, ['second'])).toBe(false);
    const slots = await engine.load(sessionId);
    expect(slots.find((s) => s.key === 'open_questions')?.value).toBe('first\nsecond');
  });
});
