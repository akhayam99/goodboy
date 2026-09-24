import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 161 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'ship it', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO open_questions
       (id, session_id, text, status, created_at, answered_at)
     VALUES ('answered', 'session', 'Already answered?', 'answered', 1, 2)`,
  );
  await db.execute(
    `INSERT INTO open_questions (id, session_id, text, status, created_at)
     VALUES ('open', 'session', 'Still open?', 'open', 1)`,
  );
  return db;
};

type QuestionRow = {
  readonly id: string;
  readonly is_blocking: number;
  readonly answer_source: string | null;
  readonly answered_by_agent_id: string | null;
};

describe('m162 open question blocking and provenance', () => {
  it('defaults blocking and backfills answered questions as user answers', async () => {
    const db = await seed();
    await migrate(db, migrations);

    const rows = await db.select<QuestionRow>(
      `SELECT id, is_blocking, answer_source, answered_by_agent_id
       FROM open_questions ORDER BY id`,
    );
    expect(rows).toEqual([
      {
        id: 'answered',
        is_blocking: 0,
        answer_source: 'user',
        answered_by_agent_id: null,
      },
      {
        id: 'open',
        is_blocking: 0,
        answer_source: null,
        answered_by_agent_id: null,
      },
    ]);
  });

  it('rejects invalid blocking and answer source values', async () => {
    const db = await seed();
    await migrate(db, migrations);

    await expect(
      db.execute("UPDATE open_questions SET is_blocking = 2 WHERE id = 'open'"),
    ).rejects.toThrow();
    await expect(
      db.execute("UPDATE open_questions SET answer_source = 'other' WHERE id = 'open'"),
    ).rejects.toThrow();
  });
});

describe('answer provenance backfill', () => {
  it('keeps an agent resolved answer as agent and the rest as user', async () => {
    const db = await seed();
    await db.execute(
      `INSERT INTO open_questions
         (id, session_id, text, status, user_answer, created_at, answered_at)
       VALUES ('resolved-by-agent', 'session', 'Settled upstream?', 'answered', '[resolved by agent]', 1, 2)`,
    );
    await migrate(db, migrations);

    const rows = await db.select<QuestionRow>(
      `SELECT id, is_blocking, answer_source, answered_by_agent_id
       FROM open_questions ORDER BY id`,
    );
    const sources = new Map(rows.map((row) => [row.id, row.answer_source]));
    expect(sources.get('resolved-by-agent')).toBe('agent');
    expect(sources.get('answered')).toBe('user');
    expect(sources.get('open')).toBeNull();
  });
});
