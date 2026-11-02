// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const h = vi.hoisted(() => ({
  listArchivedSessionsForWorkspace: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    listArchivedSessionsForWorkspace: h.listArchivedSessionsForWorkspace,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { switchEpoch } from '../workspaces/switchEpoch';

const HARBORLINE = aWorkspace({ name: 'Harborline' }).id;
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' }).id;

let useAppStore: StoryStore;

const load = (params: { readonly isForced?: boolean } = {}) =>
  useAppStore.getState().loadArchivedSessions({ workspaceId: HARBORLINE, ...params });

const cached = () => useAppStore.getState().archivedSessions[HARBORLINE];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.listArchivedSessionsForWorkspace.mockReset();
  switchEpoch.value += 1;
  useAppStore.setState({ currentWorkspaceId: HARBORLINE });
});

describe('loadArchivedSessions', () => {
  it('asks the database once and serves the cache on the next opens', async () => {
    const archived = [aSession({ workspaceId: HARBORLINE })];
    h.listArchivedSessionsForWorkspace.mockResolvedValue(archived);

    await load();
    await load();
    await load();

    expect(h.listArchivedSessionsForWorkspace).toHaveBeenCalledTimes(1);
    expect(cached()).toEqual(archived);
  });

  it('still reads the full list when only an archive action made the cache', async () => {
    const archivedNow = aSession({ workspaceId: HARBORLINE });
    const older = aSession({ workspaceId: HARBORLINE });
    useAppStore.setState({ archivedSessions: { [HARBORLINE]: [archivedNow] } });
    h.listArchivedSessionsForWorkspace.mockResolvedValue([archivedNow, older]);

    await load();

    expect(h.listArchivedSessionsForWorkspace).toHaveBeenCalledTimes(1);
    expect(cached()).toEqual([archivedNow, older]);
  });

  it('reads again after a workspace switch cleared the cache', async () => {
    h.listArchivedSessionsForWorkspace.mockResolvedValue([]);

    await load();
    switchEpoch.value += 1;
    useAppStore.setState({ archivedSessions: {} });
    await load();

    expect(h.listArchivedSessionsForWorkspace).toHaveBeenCalledTimes(2);
  });

  it('shares one request between two callers that ask at the same time', async () => {
    h.listArchivedSessionsForWorkspace.mockResolvedValue([]);

    await Promise.all([load(), load()]);

    expect(h.listArchivedSessionsForWorkspace).toHaveBeenCalledTimes(1);
  });

  it('reads again when forced, on window focus', async () => {
    const before = [aSession({ workspaceId: HARBORLINE })];
    const after = [...before, aSession({ workspaceId: HARBORLINE })];
    h.listArchivedSessionsForWorkspace.mockResolvedValueOnce(before);
    h.listArchivedSessionsForWorkspace.mockResolvedValueOnce(after);

    await load();
    await load({ isForced: true });

    expect(h.listArchivedSessionsForWorkspace).toHaveBeenCalledTimes(2);
    expect(cached()).toEqual(after);
  });

  it('files a late answer under the workspace it asked about, never under the open one', async () => {
    let release: (rows: ReadonlyArray<Session>) => void = () => undefined;
    h.listArchivedSessionsForWorkspace.mockImplementation(
      () =>
        new Promise<ReadonlyArray<Session>>((resolve) => {
          release = resolve;
        }),
    );
    const late = [aSession({ workspaceId: HARBORLINE })];

    const pending = load();
    useAppStore.setState({ currentWorkspaceId: NORTHWIND });
    release(late);
    await pending;

    expect(cached()).toEqual(late);
    expect(useAppStore.getState().archivedSessions[NORTHWIND]).toBeUndefined();
  });

  it('keeps the cache empty and rejects when a read fails, then reads again on the next ask', async () => {
    h.listArchivedSessionsForWorkspace.mockRejectedValueOnce(new Error('disk read failed'));
    h.listArchivedSessionsForWorkspace.mockResolvedValueOnce([]);

    await expect(load()).rejects.toThrow('disk read failed');
    expect(cached()).toBeUndefined();
    await load();

    expect(cached()).toEqual([]);
  });
});
