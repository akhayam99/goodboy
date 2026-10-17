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
import type { BaseDivergence, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_REPO_CHECK_MINUTES } from '../../../settings/settings';
import { useRepoDivergenceCheck } from './index';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const MINUTE_MS = 60_000;

const UP_TO_DATE: BaseDivergence = {
  state: 'up-to-date',
  base: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  checkoutBranch: 'main',
  uncommitted: 0,
  message: null,
};

const READY_STATUS = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Bump the lockfile',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

type DivergenceArgs = {
  readonly maxAgeMs: number;
};

const isDivergenceArgs = (args: unknown): args is DivergenceArgs =>
  typeof args === 'object' && args !== null && 'maxAgeMs' in args;

const divergenceCalls = (): ReadonlyArray<DivergenceArgs> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'repo_base_divergence')
    .flatMap(([, args]) => (isDivergenceArgs(args) ? [args] : []));

type SeedParams = {
  readonly minutes?: string;
};

const seed = ({ minutes }: SeedParams): void => {
  useAppStore.setState({
    projects: [
      aProject({
        workspaceId: WORKSPACE,
        name: 'payments-api',
        kind: 'repo',
        rootPath: '/work/payments-api',
      }),
    ],
    settings: minutes === undefined ? {} : { [SETTING_REPO_CHECK_MINUTES]: minutes },
  });
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

type AdvanceParams = {
  readonly ms: number;
};

const advance = async ({ ms }: AdvanceParams): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  stubStoryInvoke({
    project_git_status: READY_STATUS,
    repo_identity: null,
    repo_base_divergence: UP_TO_DATE,
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('the background divergence check', () => {
  it('checks at mount and then every five minutes by default, reusing a fresh answer', async () => {
    seed({});
    renderHook(() => useRepoDivergenceCheck({ workspaceId: WORKSPACE }));
    await flush();
    expect(divergenceCalls()).toHaveLength(1);
    expect(divergenceCalls()[0]?.maxAgeMs).toBe(Math.round(5 * MINUTE_MS * 0.9));

    await advance({ ms: 4 * MINUTE_MS });
    expect(divergenceCalls()).toHaveLength(1);

    await advance({ ms: MINUTE_MS });
    expect(divergenceCalls()).toHaveLength(2);
  });

  it('follows the interval setting and stops when it is Off', async () => {
    seed({ minutes: '15' });
    const { unmount } = renderHook(() => useRepoDivergenceCheck({ workspaceId: WORKSPACE }));
    await flush();
    await advance({ ms: 45 * MINUTE_MS });
    expect(divergenceCalls()).toHaveLength(4);
    unmount();

    storySpies.tauriInvoke.mockClear();
    seed({ minutes: '0' });
    renderHook(() => useRepoDivergenceCheck({ workspaceId: WORKSPACE }));
    await flush();
    await advance({ ms: 30 * MINUTE_MS });
    expect(divergenceCalls()).toHaveLength(0);
  });

  it('never stacks a tick on a check that is still in flight', async () => {
    seed({ minutes: '5' });
    stubStoryInvoke({
      project_git_status: READY_STATUS,
      repo_identity: null,
      repo_base_divergence: () => new Promise<never>(() => undefined),
    });
    renderHook(() => useRepoDivergenceCheck({ workspaceId: WORKSPACE }));
    await flush();
    await advance({ ms: 20 * MINUTE_MS });

    expect(divergenceCalls()).toHaveLength(1);
    expect(useAppStore.getState().repoCheckInFlight[WORKSPACE]).toBe(true);
  });

  it('leaves a workspace without repos alone', async () => {
    useAppStore.setState({ projects: [] });
    renderHook(() => useRepoDivergenceCheck({ workspaceId: WORKSPACE }));
    await flush();
    await advance({ ms: 10 * MINUTE_MS });
    expect(divergenceCalls()).toHaveLength(0);
  });
});
