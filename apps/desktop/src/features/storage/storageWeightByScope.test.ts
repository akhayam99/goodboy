// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { StorageFolder, StorageRoot } from '../../store/slices/storage/types';
import { storageWeightByScope } from './storageWeightByScope';

const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;

const folder = (overrides: Partial<StorageFolder>): StorageFolder =>
  ({
    path: '/repo/.goodboy/worktrees/x',
    repoRoot: '/repo',
    branch: 'goodboy/x',
    origin: 'ledger',
    why: 'deleted-session',
    sessionId: null,
    sessionGoal: null,
    mountId: null,
    revision: null,
    ledgerId: 'x',
    workspaceId: null,
    sessionActivityAt: null,
    sizeBytes: 0,
    sizedAt: null,
    facts: null,
    keptAt: null,
    keptUntil: null,
    ...overrides,
  }) as StorageFolder;

describe('storageWeightByScope', () => {
  it('sums bytes per owning workspace, and ownerless folders as removed', () => {
    const folders = [
      folder({ workspaceId: WS_A, sizeBytes: 1000 }),
      folder({ workspaceId: WS_A, sizeBytes: 500 }),
      folder({ workspaceId: WS_B, sizeBytes: 2000 }),
      folder({ workspaceId: null, sizeBytes: 300 }),
    ];

    const weights = storageWeightByScope({ folders, roots: [] });

    expect(weights.byWorkspace.get(WS_A)).toBe(1500);
    expect(weights.byWorkspace.get(WS_B)).toBe(2000);
    expect(weights.removedBytes).toBe(300);
  });

  it('falls back to the root workspace when a folder has none of its own', () => {
    const roots: ReadonlyArray<StorageRoot> = [
      {
        repoRoot: '/repo',
        projectName: 'repo',
        workspaceId: WS_A,
        workspaceName: 'Harborline',
        isDisconnected: false,
      },
    ];
    const folders = [folder({ workspaceId: null, sizeBytes: 700 })];

    const weights = storageWeightByScope({ folders, roots });

    expect(weights.byWorkspace.get(WS_A)).toBe(700);
    expect(weights.removedBytes).toBe(0);
  });
});
