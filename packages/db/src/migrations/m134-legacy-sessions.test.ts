import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-24T10:00:00.000Z');

const seedThrough133 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 133),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  return db;
};

type SessionParams = {
  readonly db: Database;
  readonly id: string;
};

const insertSession = async ({ db, id }: SessionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [id, NOW, NOW],
  );
};

const readLegacyAt = async (db: Database): Promise<ReadonlyArray<number | null>> => {
  const rows = await db.select<{ id: string; legacy_at: number | null }>(
    'SELECT id, legacy_at FROM sessions ORDER BY id ASC',
  );
  return rows.map((row) => row.legacy_at);
};

describe('m134 legacy sessions', () => {
  it('stamps every session that predates the migration', async () => {
    const db = await seedThrough133();
    await insertSession({ db, id: 'session-1' });
    await insertSession({ db, id: 'session-2' });

    await migrate(db, migrations);

    const stamps = await readLegacyAt(db);
    expect(stamps).toHaveLength(2);
    for (const stamp of stamps) {
      expect(stamp).toBeGreaterThan(0);
    }
  });

  it('keeps the rows and their transcripts in place', async () => {
    const db = await seedThrough133();
    await insertSession({ db, id: 'session-1' });
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, created_at)
       VALUES ('wt-1', 'session-1', '/home/dev/.goodboy/sessions/workspace/session-1/api', 'main', 0, ?)`,
      [NOW],
    );

    await migrate(db, migrations);

    const sessions = await db.select<{ id: string; goal: string }>('SELECT id, goal FROM sessions');
    const worktrees = await db.select<{ id: string; worktree_path: string }>(
      'SELECT id, worktree_path FROM session_worktrees',
    );
    expect(sessions).toEqual([{ id: 'session-1', goal: 'Goal' }]);
    expect(worktrees).toEqual([
      { id: 'wt-1', worktree_path: '/home/dev/.goodboy/sessions/workspace/session-1/api' },
    ]);
  });

  it('leaves a session created after the migration unstamped', async () => {
    const db = await seedThrough133();

    await migrate(db, migrations);
    await insertSession({ db, id: 'session-new' });

    expect(await readLegacyAt(db)).toEqual([null]);
  });

  it('stamps nothing on a fresh database', async () => {
    const db = makeTestDatabase();

    await migrate(db, migrations);

    expect(await readLegacyAt(db)).toEqual([]);
  });
});
