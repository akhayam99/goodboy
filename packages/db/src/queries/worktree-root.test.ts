import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listWorktreeRoots, markWorktreeRootScanned, registerWorktreeRoot } from './worktree-root';

describe('worktree roots', () => {
  it('lists a disconnected project root with its workspace and a user root without one', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
    );
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, disconnected_at)
       VALUES ('relay', 'workspace', 'notify-relay', '/repos/notify-relay', 'repo', 1, 1, 5)`,
    );
    await registerWorktreeRoot({ db, repoRoot: '/repos/notify-relay', addedBy: 'project' });
    await registerWorktreeRoot({ db, repoRoot: '/repos/cascadia', addedBy: 'user' });
    await registerWorktreeRoot({ db, repoRoot: '/repos/cascadia', addedBy: 'mount' });
    await registerWorktreeRoot({ db, repoRoot: ' ', addedBy: 'mount' });
    await markWorktreeRootScanned({
      db,
      repoRoot: '/repos/cascadia',
      scannedAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
    });

    expect(await listWorktreeRoots({ db })).toEqual([
      expect.objectContaining({
        repoRoot: '/repos/cascadia',
        addedBy: 'user',
        projectId: null,
        workspaceName: null,
        isDisconnected: false,
        lastScannedAt: '2026-09-20T10:00:00.000Z',
      }),
      expect.objectContaining({
        repoRoot: '/repos/notify-relay',
        projectName: 'notify-relay',
        workspaceName: 'Northwind',
        isDisconnected: true,
      }),
    ]);
  });
});
