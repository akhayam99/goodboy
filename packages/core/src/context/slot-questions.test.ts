import { describe, expect, it } from 'vitest';
import { migrate, type Database as DbInterface } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ContextEngine } from './engine';
import {
  addQuestionsToSlot,
  removeQuestionsFromSlot,
  removeSessionQuestionsFromSlots,
} from './slot-questions';
import { makeTestDatabase } from '@goodboy/db/test-helpers';

const makeDb = (): DbInterface => makeTestDatabase();

async function seed(db: DbInterface, sessionId: SessionId): Promise<void> {
  const workspaceId = 'ws_sq' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', workspaceId, 0, 0],
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

  it('removes questions from the slot of each session they came from', async () => {
    const db = makeDb();
    await migrate(db);
    const first = 'task_sq_multi_1' as SessionId;
    const second = 'task_sq_multi_2' as SessionId;
    const untouched = 'task_sq_multi_3' as SessionId;
    await seed(db, first);
    for (const sessionId of [second, untouched]) {
      await db.execute(
        `INSERT INTO sessions (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
         VALUES (?, 'ws_sq', 'demo', 'idle', 0, 0, 0)`,
        [sessionId],
      );
    }
    const engine = new ContextEngine({ db });
    await engine.upsert(first, 'open_questions', 'keep\nwhich cache?\nwhich port?');
    await engine.upsert(second, 'open_questions', 'which region?');
    await engine.upsert(untouched, 'open_questions', 'which cache?');

    const changed = await removeSessionQuestionsFromSlots({
      db,
      questions: [
        { sessionId: first, text: 'which cache?' },
        { sessionId: second, text: 'which region?' },
        { sessionId: first, text: 'which port?' },
      ],
    });

    expect(changed).toEqual([first, second]);
    const valueOf = async (sessionId: SessionId) =>
      (await engine.load(sessionId)).find((s) => s.key === 'open_questions')?.value;
    expect(await valueOf(first)).toBe('keep');
    expect(await valueOf(second)).toBe('');
    expect(await valueOf(untouched)).toBe('which cache?');
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
