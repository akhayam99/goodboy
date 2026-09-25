import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { checkStorageNudge } from './checkStorageNudge';
import { selectStorageAttention, selectStorageAttentionTone } from './selectStorageAttention';
import { STORAGE_LAST_NUDGE_AT_KEY, STORAGE_LAST_NUDGE_BYTES_KEY } from './storageSettings';
import type { StorageFolder } from './types';

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;

const idleFolder = (name: string): StorageFolder => ({
  path: `/repos/ledger-core/.goodboy/worktrees/${name}`,
  repoRoot: '/repos/ledger-core',
  branch: `goodboy/${name}`,
  origin: 'ledger',
  why: 'no-session',
  sessionId: null,
  sessionGoal: null,
  mountId: null,
  revision: null,
  ledgerId: name,
  workspaceId: 'harborline' as WorkspaceId,
  sessionActivityAt: null,
  sizeBytes: 6 * GB,
  sizedAt: Date.now(),
  facts: {
    path: `/repos/ledger-core/.goodboy/worktrees/${name}`,
    exists: true,
    isRegistered: true,
    branch: `goodboy/${name}`,
    lastCommitAt: Date.now() - 40 * DAY,
    localOnlyCommits: 0,
    changedFiles: 0,
    changedSample: null,
    reasons: [],
  },
  keptAt: null,
  keptUntil: null,
});

const makeState = (settings: Record<string, string>) => ({
  storageFolders: [idleFolder('a'), idleFolder('b')],
  storageStats: null,
  settings,
  loadSetting: vi.fn(async () => null),
  saveSetting: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
});

describe('checkStorageNudge', () => {
  it('sends one storage notification that opens Storage and remembers when', async () => {
    const state = makeState({});

    await checkStorageNudge(vi.fn(), () => state as unknown as AppStore)();

    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storage-reclaimable',
        severity: 'info',
        title: 'Goodboy can free 12 GB',
        action: { kind: 'open-storage', filter: 'review' },
        coalesceKey: 'storage-reclaimable',
      }),
    );
    expect(state.saveSetting).toHaveBeenCalledWith(STORAGE_LAST_NUDGE_AT_KEY, expect.any(String));
    expect(state.saveSetting).toHaveBeenCalledWith(STORAGE_LAST_NUDGE_BYTES_KEY, String(12 * GB));
  });

  it('stays quiet inside the 14 days after the last nudge', async () => {
    const state = makeState({ [STORAGE_LAST_NUDGE_AT_KEY]: String(Date.now() - DAY) });

    await checkStorageNudge(vi.fn(), () => state as unknown as AppStore)();

    expect(state.emitNotification).not.toHaveBeenCalled();
  });
});

describe('selectStorageAttention', () => {
  it('puts an info dot with the amount on the Storage row above 10 GB', () => {
    const state = makeState({});

    expect(selectStorageAttention({ state })).toBe('12 GB can go');
    expect(selectStorageAttentionTone({ state })).toBe('info');
  });

  it('shows no dot under 10 GB', () => {
    const state = { ...makeState({}), storageFolders: [idleFolder('a')] };

    expect(selectStorageAttention({ state })).toBeNull();
    expect(selectStorageAttentionTone({ state })).toBeNull();
  });
});
