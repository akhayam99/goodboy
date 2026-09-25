import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m183WorktreeRoots } from './m183-worktree-roots';
import { migrations } from './index';
import { migrate } from './runner';

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 182 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, disconnected_at)
     VALUES ('ledger', 'workspace', 'ledger-core', '/repos/ledger-core', 'repo', 10, 10, NULL),
            ('relay', 'workspace', 'notify-relay', '/repos/notify-relay', 'repo', 11, 11, 20),
            ('notes', 'workspace', 'Notes', '/notes', 'folder', 12, 12, NULL)`,
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, worktree_path, last_worktree_path, branch, created_at)
     VALUES ('live', 'session', '/repos/payments-api/.goodboy/worktrees/refunds-live', NULL, 'goodboy/refunds', 30),
            ('gone', 'session', NULL, '/repos/acme-web/.goodboy/worktrees/old-live', 'goodboy/old', 31),
            ('plain', 'session', '/elsewhere/checkout', NULL, 'goodboy/plain', 32)`,
  );
  await db.execute(
    `INSERT INTO retained_worktree_paths
      (id, repo_root, worktree_path, branch, reason, first_seen_at, created_at, updated_at)
     VALUES ('orphan', '/repos/cascadia', '/repos/cascadia/.goodboy/worktrees/x', '', 'orphan', 40, 40, 40)`,
  );
  return db;
};

describe('m183 worktree roots', () => {
  it('registers repositories from projects, including disconnected ones, the ledger and mounts', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT repo_root, first_seen_at, added_by FROM worktree_roots ORDER BY repo_root',
      ),
    ).toEqual([
      { repo_root: '/repos/acme-web', first_seen_at: 31, added_by: 'mount' },
      { repo_root: '/repos/cascadia', first_seen_at: 40, added_by: 'mount' },
      { repo_root: '/repos/ledger-core', first_seen_at: 10, added_by: 'project' },
      { repo_root: '/repos/notify-relay', first_seen_at: 11, added_by: 'project' },
      { repo_root: '/repos/payments-api', first_seen_at: 30, added_by: 'mount' },
    ]);
  });

  it('reruns without duplicating a root', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await db.exec(m183WorktreeRoots);

    expect(await db.select('SELECT COUNT(*) AS count FROM worktree_roots')).toEqual([{ count: 5 }]);
  });
});
