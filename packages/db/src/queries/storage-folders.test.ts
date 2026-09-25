import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listStorageMounts, listStorageSessionRefs } from './storage-folders';

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES ('ledger', 'workspace', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1)`,
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at, deleted_at, last_activity_at)
     VALUES ('live', 'workspace', 'Close the ledger month', 'idle', 1, 5, NULL, NULL, 9),
            ('archived', 'workspace', 'Settle batch retry', 'idle', 1, 6, 7, NULL, NULL),
            ('deleted', 'workspace', 'Rounding drift', 'idle', 1, 8, NULL, 10, NULL)`,
  );
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, project_id, worktree_path, branch, created_at)
     VALUES ('m-live', 'live', 'ledger', '/repos/ledger-core/.goodboy/worktrees/close', 'goodboy/close', 1),
            ('m-archived', 'archived', 'ledger', '/repos/ledger-core/.goodboy/worktrees/settle', 'goodboy/settle', 1),
            ('m-deleted', 'deleted', 'ledger', '/repos/ledger-core/.goodboy/worktrees/drift', 'goodboy/drift', 1),
            ('m-folder', 'live', NULL, '/notes/sessions/close', '', 1)`,
  );
  return db;
};

describe('storage folder queries', () => {
  it('lists repository mounts of sessions that still exist with their repository root', async () => {
    const db = await seed();

    const rows = await listStorageMounts({ db });

    expect(
      rows.map((row) => [row.mountId, row.repoRoot, row.archivedAt, row.lastActivityAt]),
    ).toEqual([
      ['m-live', '/repos/ledger-core', null, 9],
      ['m-archived', '/repos/ledger-core', 7, 6],
    ]);
  });

  it('reads the goal and dates of the sessions a ledger row points at', async () => {
    const db = await seed();

    const refs = await listStorageSessionRefs({ db, sessionIds: ['deleted' as SessionId] });

    expect(refs).toEqual([
      {
        sessionId: 'deleted',
        goal: 'Rounding drift',
        archivedAt: null,
        deletedAt: 10,
        lastActivityAt: 8,
      },
    ]);
    expect(await listStorageSessionRefs({ db, sessionIds: [] })).toEqual([]);
  });
});
