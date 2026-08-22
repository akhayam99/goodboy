import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const through111 = migrations.filter((migration) => migration.version <= 111);

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough110 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 110),
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
  readonly id: string;
  readonly branch: string;
  readonly parallelIndex: number;
};

const insertWorktree = async ({ db, id, branch, parallelIndex }: WorktreeParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_worktrees
       (id, session_id, worktree_path, branch, parallel_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sessionId, `/tmp/${id}`, branch, parallelIndex, Date.now()],
  );
};

type SlugRow = {
  readonly id: string;
  readonly repo_slug: string | null;
};

type DbParams = {
  readonly db: Database;
};

const slugRows = async ({ db }: DbParams): Promise<ReadonlyArray<SlugRow>> =>
  db.select<SlugRow>('SELECT id, repo_slug FROM session_worktrees ORDER BY id');

describe('m111 session worktree repo slug', () => {
  it('leaves an existing worktree row without a slug and backfills nothing', async () => {
    const db = await seedThrough110();
    await insertWorktree({ db, id: 'wt-old', branch: 'ak/feature', parallelIndex: 0 });

    await migrate(db, through111);

    expect(await slugRows({ db })).toEqual([{ id: 'wt-old', repo_slug: null }]);
  });

  it('stores a slug written after the migration', async () => {
    const db = await seedThrough110();

    await migrate(db, through111);
    await insertWorktree({ db, id: 'wt-new', branch: 'ak/feature', parallelIndex: 0 });
    await db.execute('UPDATE session_worktrees SET repo_slug = ? WHERE id = ?', [
      'org/repo',
      'wt-new',
    ]);

    expect(await slugRows({ db })).toEqual([{ id: 'wt-new', repo_slug: 'org/repo' }]);
  });

  it('adds the join index and keeps the existing indexes and foreign keys', async () => {
    const db = await seedThrough110();
    await insertWorktree({ db, id: 'wt-old', branch: 'ak/feature', parallelIndex: 0 });

    await migrate(db, through111);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_worktrees' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_session_worktrees_path',
      'idx_session_worktrees_repo_slug_branch',
      'idx_session_worktrees_session_id',
    ]);
    expect(await db.select<{ rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });
});
