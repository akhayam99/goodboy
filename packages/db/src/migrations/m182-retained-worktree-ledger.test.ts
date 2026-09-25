import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 173 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO retained_worktree_paths
      (id, workspace_id, project_id, source_session_id, source_mount_id, repo_root,
       worktree_path, branch, reason, last_checked_at, created_at, updated_at)
     VALUES ('kept', 'workspace', NULL, 'session', 'mount', '/repos/ledger-core',
       '/repos/ledger-core/.goodboy/worktrees/rounding-drift', 'goodboy/rounding-drift',
       'session_delete', 5, 3, 4)`,
  );
  return db;
};

describe('m182 retained worktree ledger', () => {
  it('copies every retained row and dates its first sighting from its creation', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT id, workspace_id, source_session_id, reason, first_seen_at, size_bytes, kept_until FROM retained_worktree_paths',
      ),
    ).toEqual([
      {
        id: 'kept',
        workspace_id: 'workspace',
        source_session_id: 'session',
        reason: 'session_delete',
        first_seen_at: 3,
        size_bytes: null,
        kept_until: null,
      },
    ]);
  });

  it('accepts an orphan folder without an owner', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await db.execute(
      `INSERT INTO retained_worktree_paths
        (id, repo_root, worktree_path, branch, reason, first_seen_at, created_at, updated_at)
       VALUES ('orphan', '/repos/ledger-core', '/repos/ledger-core/.goodboy/worktrees/fx-rates', '', 'orphan', 7, 7, 7)`,
    );

    expect(
      await db.select(
        "SELECT workspace_id, source_session_id FROM retained_worktree_paths WHERE id = 'orphan'",
      ),
    ).toEqual([{ workspace_id: null, source_session_id: null }]);
  });

  it('keeps the row when its workspace is deleted', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await db.execute("DELETE FROM workspaces WHERE id = 'workspace'");

    expect(await db.select('SELECT id, workspace_id FROM retained_worktree_paths')).toEqual([
      { id: 'kept', workspace_id: null },
    ]);
  });

  it('reruns cleanly when a crash left the staging table behind', async () => {
    const db = await seedBefore();
    await db.execute('CREATE TABLE retained_worktree_paths_new (id TEXT PRIMARY KEY)');

    await migrate(db, migrations);

    expect(await db.select('SELECT id FROM retained_worktree_paths')).toEqual([{ id: 'kept' }]);
  });
});
