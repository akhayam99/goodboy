import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough111 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 111),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type ModeRow = {
  readonly id: string;
  readonly select_mode: string | null;
};

const modeRows = async (db: Database): Promise<ReadonlyArray<ModeRow>> =>
  db.select<ModeRow>('SELECT id, select_mode FROM open_questions ORDER BY id');

describe('m112 open questions select mode', () => {
  it('leaves an existing open question with a null select_mode after upgrade', async () => {
    const db = await seedThrough111();
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, suggested_answers, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      ['oq-old', sessionId, 'pre-existing question', '[]', Date.now()],
    );

    await migrate(db, migrations);

    expect(await modeRows(db)).toEqual([{ id: 'oq-old', select_mode: null }]);
  });

  it('stores "one" and "many" values written after the migration', async () => {
    const db = await seedThrough111();
    await migrate(db, migrations);

    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, suggested_answers, select_mode, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      ['oq-one', sessionId, 'single', '[]', 'one', Date.now()],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, suggested_answers, select_mode, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      ['oq-many', sessionId, 'multi', '[]', 'many', Date.now()],
    );

    expect(await modeRows(db)).toEqual([
      { id: 'oq-many', select_mode: 'many' },
      { id: 'oq-one', select_mode: 'one' },
    ]);
  });

  it('rejects a select_mode value outside the allowed pair', async () => {
    const db = await seedThrough111();
    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO open_questions (id, session_id, text, suggested_answers, select_mode, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
        ['oq-bad', sessionId, 'bad', '[]', 'lots', Date.now()],
      ),
    ).rejects.toBeDefined();
  });
});
