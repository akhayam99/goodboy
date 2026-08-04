import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough102 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 102),
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

type WorktreeParams = {
  readonly db: Database;
  readonly branch: string;
  readonly parallelIndex: number;
};

const insertWorktree = async ({ db, branch, parallelIndex }: WorktreeParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `wt-${parallelIndex}`,
      sessionId,
      `/tmp/wt-${parallelIndex}`,
      branch,
      parallelIndex,
      Date.now(),
    ],
  );
};

type TaskParams = {
  readonly db: Database;
  readonly externalId: string;
};

const insertTask = async ({ db, externalId }: TaskParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_external_tasks
       (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at)
     VALUES (?, NULL, 'linear', ?, ?, 'https://linear.app/goodboy/issue/GB-1', 'Ship it', ?)`,
    [sessionId, externalId, externalId, Date.now()],
  );
};

type DbParams = {
  readonly db: Database;
};

const branchRows = async ({
  db,
}: DbParams): Promise<ReadonlyArray<{ external_id: string; branch: string | null }>> =>
  db.select<{ external_id: string; branch: string | null }>(
    'SELECT external_id, branch FROM session_external_tasks ORDER BY external_id',
  );

describe('m103 session external task branch', () => {
  it('backfills an existing link with the branch of the session', async () => {
    const db = await seedThrough102();
    await insertWorktree({ db, branch: 'ak/fix-auth', parallelIndex: 0 });
    await insertTask({ db, externalId: 'GB-1' });

    await migrate(db, migrations);

    expect(await branchRows({ db })).toEqual([{ external_id: 'GB-1', branch: 'ak/fix-auth' }]);
  });

  it('backfills from the primary worktree when the session has several', async () => {
    const db = await seedThrough102();
    await insertWorktree({ db, branch: 'ak/primary', parallelIndex: 0 });
    await insertWorktree({ db, branch: 'ak/parallel', parallelIndex: 1 });
    await insertTask({ db, externalId: 'GB-2' });

    await migrate(db, migrations);

    expect(await branchRows({ db })).toEqual([{ external_id: 'GB-2', branch: 'ak/primary' }]);
  });

  it('leaves a link with no worktree unstamped instead of failing', async () => {
    const db = await seedThrough102();
    await insertTask({ db, externalId: 'GB-3' });

    await migrate(db, migrations);

    expect(await branchRows({ db })).toEqual([{ external_id: 'GB-3', branch: null }]);
  });

  it('keeps the identity index and the cascade of the table', async () => {
    const db = await seedThrough102();
    await insertWorktree({ db, branch: 'ak/fix-auth', parallelIndex: 0 });
    await insertTask({ db, externalId: 'GB-4' });

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_external_tasks' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_session_external_tasks_identity',
      'idx_session_external_tasks_provider_external',
    ]);
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
    expect(await branchRows({ db })).toEqual([]);
  });
});
