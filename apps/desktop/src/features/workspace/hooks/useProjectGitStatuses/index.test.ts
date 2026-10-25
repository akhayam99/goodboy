// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aProject } from '@goodboy/types/testing';
import type { WorkspaceGitStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { harborline, ledgerCore, paymentsApi } from '../../testing/sessionColumn';
import { useProjectGitStatuses } from './index';

let useAppStore: StoryStore;

const ready: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const apiRepo = { ...paymentsApi, rootPath: '/tmp/payments-api' };
const notesFolder = aProject({ workspaceId: harborline.id, name: 'notes', kind: 'folder' });

const statusCalls = (): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'project_git_status')
    .map(([, args]) => args);

const settle = async (milliseconds: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ project_git_status: ready, repo_identity: null });
  vi.useFakeTimers();
  useAppStore.setState({
    projects: [ledgerCore, notesFolder, apiRepo],
    projectGitStatus: {},
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useProjectGitStatuses', () => {
  it('lists repo projects only and loads each status into the store', async () => {
    const { result } = renderHook(() => useProjectGitStatuses({ workspaceId: harborline.id }));
    await settle(0);

    expect(result.current).toEqual([
      { project: ledgerCore, status: ready },
      { project: apiRepo, status: ready },
    ]);
    expect(useAppStore.getState().projectGitStatus[notesFolder.id]).toBeUndefined();
    expect(statusCalls()).toEqual([
      { projectPath: ledgerCore.rootPath },
      { projectPath: apiRepo.rootPath },
    ]);
  });

  it('polls every repo project while the document is visible', async () => {
    renderHook(() => useProjectGitStatuses({ workspaceId: harborline.id }));
    await settle(0);
    const before = statusCalls().length;

    await settle(30_000);

    expect(statusCalls().length - before).toBe(2);
  });

  it('shows a missing status when the read fails', async () => {
    stubStoryInvoke({
      repo_identity: null,
      project_git_status: () => {
        throw new Error('git unreachable');
      },
    });
    const { result } = renderHook(() => useProjectGitStatuses({ workspaceId: harborline.id }));
    await settle(0);

    expect(result.current.map((entry) => entry.status?.state)).toEqual(['missing', 'missing']);
  });
});
