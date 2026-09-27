import { describe, expect, it } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertSessionWorktree } from './session-worktree';
import { listGoodboyBranches } from './goodboy-branch';

const projectId = 'ledger' as ProjectId;

describe('listGoodboyBranches', () => {
  it('lists each branch Goodboy made in a project once, with its live session', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
    );
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
       VALUES ('ledger', 'harborline', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1)`,
    );
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES ('close', 'harborline', 'Close the ledger month', 'idle', 1, 1),
              ('gone', 'harborline', 'Old work', 'idle', 1, 1)`,
    );
    await db.execute("UPDATE sessions SET deleted_at = 5 WHERE id = 'gone'");
    await insertSessionWorktree(db, {
      id: 'mount-close',
      sessionId: 'close' as SessionId,
      worktreePath: '/worktrees/close',
      branch: 'goodboy/ledger-close',
      parallelIndex: 0,
      projectId,
      createdAt: 10,
    });
    await insertSessionWorktree(db, {
      id: 'mount-gone',
      sessionId: 'gone' as SessionId,
      worktreePath: '/worktrees/gone',
      branch: 'goodboy/old-work',
      parallelIndex: 0,
      projectId,
      createdAt: 20,
    });

    const branches = await listGoodboyBranches({ db, projectId });

    expect([...branches].sort((a, b) => a.branch.localeCompare(b.branch))).toEqual([
      { projectId, branch: 'goodboy/ledger-close', sessionId: 'close' },
      { projectId, branch: 'goodboy/old-work', sessionId: null },
    ]);
  });
});
