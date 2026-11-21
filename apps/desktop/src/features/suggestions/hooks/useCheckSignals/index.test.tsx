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
import {
  brandId,
  type MountId,
  type PrCheckRun,
  type ProjectId,
  type SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useCheckSignals } from '.';

const JOB = 'https://github.com/acme/ledger-core/actions/runs/9001/job/42';
const T0 = Date.UTC(2026, 10, 21, 10, 0, 0);
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const PROJECT = aProject({});
const SESSION = aSession({ workspaceId: PROJECT.workspaceId });

const CHECK: PrCheckRun = {
  name: 'integration-tests',
  conclusion: 'failure',
  detailsUrl: JOB,
  durationMs: 1_000,
};

const MOUNT_ROW: SessionProjectMount = {
  mountId: MOUNT,
  sessionId: SESSION.id,
  projectId: brandId<ProjectId>({ value: PROJECT.id }),
  mountName: 'ledger-core',
  worktreePath: '/work/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/work/ledger-core',
  branch: 'hl/rounding',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  useAppStore.setState({
    mountGithub: {
      [MOUNT]: {
        mountId: MOUNT,
        projectId: MOUNT_ROW.projectId,
        revision: 1,
        repository: 'acme/ledger-core',
        host: 'github.com',
        branch: 'hl/rounding',
        prs: [],
        links: [],
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
        pr: {
          number: 309,
          title: 'Round half up',
          url: 'https://github.com/acme/ledger-core/pull/309',
          state: 'open',
          mergeable: true,
          checks: 'failure',
          baseBranch: 'main',
          headBranch: 'hl/rounding',
          isDraft: false,
          reviewDecision: null,
          body: '',
          updatedAt: new Date(T0).toISOString(),
        },
        detail: {
          prNumber: 309,
          comments: [],
          reviews: [],
          reviewRequests: [],
          checks: [CHECK],
        },
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ghCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run').length;

describe('useCheckSignals', () => {
  it('asks for a log gh could not give again after ten minutes, with no other change', async () => {
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
      command === 'gh_run' ? { stdout: '', stderr: 'no network', exitCode: 1 } : undefined,
    );
    const { result } = renderHook(() => useCheckSignals({ session: SESSION, mounts: [MOUNT_ROW] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(ghCalls()).toBe(1);
    expect(result.current.checkLogs).toHaveLength(1);
    expect(result.current.checkLogs[0]?.status).toBe('none');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60_000);
    });
    expect(ghCalls()).toBe(1);

    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
      command === 'gh_run'
        ? { stdout: ' FAIL  src/ledger/rounding.test.ts\n', stderr: '', exitCode: 0 }
        : undefined,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(ghCalls()).toBe(2);
    expect(result.current.checkLogs[0]?.status).toBe('ready');
    expect(result.current.checkLogs[0]?.fetchedAt).not.toBe(new Date(T0).toISOString());
  });

  it('keeps asking every ten minutes while the log stays out of reach', async () => {
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
      command === 'gh_run' ? { stdout: '', stderr: 'no network', exitCode: 1 } : undefined,
    );
    renderHook(() => useCheckSignals({ session: SESSION, mounts: [MOUNT_ROW] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000 + 100);
    });
    expect(ghCalls()).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000 + 100);
    });
    expect(ghCalls()).toBe(3);
  });

  it('stops asking once the log was read', async () => {
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
      command === 'gh_run'
        ? { stdout: ' FAIL  src/ledger/rounding.test.ts\n', stderr: '', exitCode: 0 }
        : undefined,
    );
    renderHook(() => useCheckSignals({ session: SESSION, mounts: [MOUNT_ROW] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60_000);
    });
    expect(ghCalls()).toBe(1);
  });
});
