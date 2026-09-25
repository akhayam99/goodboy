import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountId, SessionId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listAllRetainedWorktreePaths,
  transferMountPathToRetained,
} from './retained-worktree-path';
import { insertSessionWorktree } from './session-worktree';
import {
  deleteWorktreeLedgerEntries,
  listWorktreeLedger,
  recordOrphanWorktrees,
  setWorktreeLedgerKeep,
  setWorktreeLedgerSize,
} from './worktree-ledger';

const seenAt = '2026-09-20T10:00:00.000Z' as IsoDateTime;
const path = '/repos/ledger-core/.goodboy/worktrees/fx-rates';

const orphan = {
  repoRoot: '/repos/ledger-core',
  worktreePath: path,
  branch: 'goodboy/fx-rates',
  workspaceId: null,
  projectId: null,
  sizeBytes: null,
};

describe('worktree ledger', () => {
  it('records an orphan once and keeps its first sighting', async () => {
    const db = await makeMigratedTestDatabase();

    await recordOrphanWorktrees({ db, orphans: [orphan], seenAt });
    await recordOrphanWorktrees({
      db,
      orphans: [orphan],
      seenAt: '2026-09-21T10:00:00.000Z' as IsoDateTime,
    });

    const ledger = await listWorktreeLedger({ db });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      reason: 'orphan',
      sourceSessionId: null,
      firstSeenAt: seenAt,
      lastCheckedAt: '2026-09-21T10:00:00.000Z',
    });
    expect(await listAllRetainedWorktreePaths({ db })).toEqual([]);
  });

  it('stores size and keep, then deletes by id', async () => {
    const db = await makeMigratedTestDatabase();
    await recordOrphanWorktrees({ db, orphans: [orphan], seenAt });

    await setWorktreeLedgerSize({ db, worktreePath: path, sizeBytes: 4096, sizedAt: seenAt });
    await setWorktreeLedgerKeep({ db, worktreePath: path, keptAt: seenAt, keptUntil: null });

    const [entry] = await listWorktreeLedger({ db });
    expect(entry).toMatchObject({
      sizeBytes: 4096,
      sizedAt: seenAt,
      keptAt: seenAt,
      keptUntil: null,
    });

    await deleteWorktreeLedgerEntries({ db, ids: [entry!.id] });
    expect(await listWorktreeLedger({ db })).toEqual([]);
  });

  it('lets a retained transfer replace an orphan row for the same path', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
    );
    await insertSessionWorktree(db, {
      id: 'mount' as MountId,
      sessionId: 'session' as SessionId,
      worktreePath: path,
      branch: 'goodboy/fx-rates',
      parallelIndex: 0,
      createdAt: 1,
    });
    await recordOrphanWorktrees({ db, orphans: [orphan], seenAt });

    const moved = await transferMountPathToRetained({
      db,
      expectedRevision: 0,
      retained: {
        id: 'retained',
        workspaceId: 'workspace' as WorkspaceId,
        projectId: null,
        sourceSessionId: 'session' as SessionId,
        sourceMountId: 'mount' as MountId,
        repoRoot: '/repos/ledger-core',
        worktreePath: path,
        branch: 'goodboy/fx-rates',
        reason: 'unmount',
        lastCheckedAt: null,
        createdAt: seenAt,
        updatedAt: seenAt,
      },
    });

    expect(moved).toBe(true);
    expect((await listWorktreeLedger({ db })).map((entry) => entry.reason)).toEqual(['unmount']);
  });
});
