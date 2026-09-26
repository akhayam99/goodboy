import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { StorageArtifact } from './types';

const {
  listOrphanArtifacts,
  setArtifactKeep,
  purgeOrphanArtifact,
  measureArtifactMirrors,
  removeArtifactMirror,
} = vi.hoisted(() => ({
  listOrphanArtifacts: vi.fn(),
  setArtifactKeep: vi.fn(async () => undefined),
  purgeOrphanArtifact: vi.fn(async () => undefined),
  measureArtifactMirrors: vi.fn(),
  removeArtifactMirror: vi.fn(async (_params: { readonly folder: string }) => true),
}));

vi.mock('@goodboy/db', () => ({ listOrphanArtifacts, setArtifactKeep, purgeOrphanArtifact }));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/artifacts/artifactMirror/artifactMirrorInvoke', () => ({
  measureArtifactMirrors,
  removeArtifactMirror,
}));

import {
  isStorageArtifactKept,
  isStorageArtifactSuggested,
  storageArtifactLastUsed,
} from './classifyStorageArtifact';
import { STORAGE_DAY_MS } from './classifyStorageFolder';
import { deleteStorageArtifacts } from './deleteStorageArtifacts';
import { keepStorageArtifact } from './keepStorageArtifact';
import { loadStorageArtifacts } from './loadStorageArtifacts';

const NOW = 200 * STORAGE_DAY_MS;

const artifact = (overrides: Partial<StorageArtifact>): StorageArtifact => ({
  id: 'report-1' as ArtifactId,
  kind: 'report',
  title: 'Settlement batch sizing',
  sessionGoal: 'Settle batch retry',
  deletedAt: NOW - 45 * STORAGE_DAY_MS,
  updatedAt: NOW - 70 * STORAGE_DAY_MS,
  openedAt: null,
  keptAt: null,
  keptUntil: null,
  sessionId: 'session-gone' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
  workspaceName: 'Harborline',
  workspaceSlug: 'harborline',
  folder: '2026-07-01-settlement-batch-sizing-port1',
  sizeBytes: 4096,
  ...overrides,
});

type State = {
  storageArtifacts: ReadonlyArray<StorageArtifact>;
  storageDeletingArtifacts: Readonly<Record<string, true>>;
};

const wire = (artifacts: ReadonlyArray<StorageArtifact>) => {
  const state: State = { storageArtifacts: artifacts, storageDeletingArtifacts: {} };
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (current: State) => object)(state) : updater;
    Object.assign(state, patch);
  });
  const get = () => state as unknown as AppStore;
  return { state, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyStorageArtifact', () => {
  it('uses the latest of the last opening and the last edit', () => {
    expect(storageArtifactLastUsed({ artifact: artifact({}) })).toBe(NOW - 70 * STORAGE_DAY_MS);
    expect(
      storageArtifactLastUsed({ artifact: artifact({ openedAt: NOW - STORAGE_DAY_MS }) }),
    ).toBe(NOW - STORAGE_DAY_MS);
  });

  it('suggests an artifact deleted over the threshold and unused for twice as long', () => {
    const params = { now: NOW, suggestAfterDays: 30 };
    expect(isStorageArtifactSuggested({ artifact: artifact({}), ...params })).toBe(true);
    expect(
      isStorageArtifactSuggested({
        artifact: artifact({ openedAt: NOW - 2 * STORAGE_DAY_MS }),
        ...params,
      }),
    ).toBe(false);
    expect(
      isStorageArtifactSuggested({
        artifact: artifact({ deletedAt: NOW - 10 * STORAGE_DAY_MS }),
        ...params,
      }),
    ).toBe(false);
    expect(
      isStorageArtifactSuggested({
        artifact: artifact({ keptAt: NOW, keptUntil: null }),
        ...params,
      }),
    ).toBe(false);
  });

  it('lets a timed keep run out', () => {
    const kept = artifact({ keptAt: NOW, keptUntil: NOW + 30 * STORAGE_DAY_MS });
    expect(isStorageArtifactKept({ artifact: kept, now: NOW })).toBe(true);
    expect(isStorageArtifactKept({ artifact: kept, now: NOW + 31 * STORAGE_DAY_MS })).toBe(false);
  });
});

describe('storage artifact actions', () => {
  it('loads orphans with their mirror folder and measured size', async () => {
    listOrphanArtifacts.mockResolvedValue([
      {
        ...artifact({}),
        id: 'abcdef123456',
        createdAt: '2026-07-01T09:00:00.000Z',
        revision: 1,
      },
    ]);
    measureArtifactMirrors.mockResolvedValue([
      {
        workspaceSlug: 'harborline',
        folder: '2026-07-01-settlement-batch-sizing-123456',
        sizeBytes: 8192,
      },
    ]);
    const { state, set, get } = wire([]);

    await loadStorageArtifacts(set, get)();

    expect(state.storageArtifacts.map((entry) => [entry.folder, entry.sizeBytes])).toEqual([
      ['2026-07-01-settlement-batch-sizing-123456', 8192],
    ]);
  });

  it('keeps for 30 days, then stops keeping', async () => {
    const { state, set, get } = wire([artifact({})]);

    await keepStorageArtifact(set, get)({ id: 'report-1' as ArtifactId, days: 30 });
    expect(state.storageArtifacts[0]?.keptAt).not.toBeNull();
    expect(state.storageArtifacts[0]?.keptUntil).not.toBeNull();

    await keepStorageArtifact(
      set,
      get,
    )({ id: 'report-1' as ArtifactId, days: null, isStopping: true });
    expect(state.storageArtifacts[0]?.keptAt).toBeNull();
    expect(setArtifactKeep).toHaveBeenLastCalledWith(
      expect.objectContaining({ keptAt: null, keptUntil: null }),
    );
  });

  it('deletes the copy on disk before the record and reports a failure per artifact', async () => {
    const good = artifact({});
    const bad = artifact({ id: 'report-2' as ArtifactId, folder: 'broken' });
    removeArtifactMirror.mockImplementation(async ({ folder }: { readonly folder: string }) => {
      if (folder === 'broken') {
        throw new Error('the saved copy is not a folder');
      }
      return true;
    });
    const { state, set, get } = wire([good, bad]);

    const outcome = await deleteStorageArtifacts(set, get)({ ids: [good.id, bad.id] });

    expect(outcome.deleted).toBe(1);
    expect(outcome.failed).toEqual([{ id: 'report-2', message: 'the saved copy is not a folder' }]);
    expect(purgeOrphanArtifact).toHaveBeenCalledTimes(1);
    expect(state.storageArtifacts.map((entry) => entry.id)).toEqual(['report-2']);
    expect(state.storageDeletingArtifacts).toEqual({});
  });
});
