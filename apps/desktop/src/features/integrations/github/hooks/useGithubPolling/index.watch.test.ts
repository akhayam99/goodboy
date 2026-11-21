// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type PullRequestChecks,
  type PullRequestState,
  type SessionMountView,
} from '@goodboy/types';
import { aProject, aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { aMountGithub } from '../../../../../store/slices/github/testing/aMountGithub';
import { WATCH } from './WATCH';
import { rerunNotes } from '../../rerunNotes';
import { useGithubPolling } from './index';

let useAppStore: StoryStore;

const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const ledgerProject = aProject({ name: 'ledger-core' });
const session = aSession({ goal: 'Speed up the payout export' });

const mountView: SessionMountView = {
  id: LEDGER_MOUNT,
  sessionId: session.id,
  projectId: ledgerProject.id,
  mountName: 'ledger-core',
  worktreePath: '/worktrees/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'ak/payout-export',
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: 'harborline/ledger-core',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

type PrParams = {
  readonly checks: PullRequestChecks;
  readonly state?: PullRequestState['state'];
};

const prOf = ({ checks, state = 'open' }: PrParams): PullRequestState => ({
  number: 418,
  title: 'Speed up the payout export',
  url: 'https://github.com/harborline/ledger-core/pull/418',
  state,
  mergeable: true,
  checks,
  baseBranch: 'main',
  headBranch: 'ak/payout-export',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
  headSha: 'a41c9e2',
});

const sweep = vi.fn(async (_options?: unknown) => undefined);
type EnqueueAgentMessage = ReturnType<StoryStore['getState']>['enqueueAgentMessage'];

const enqueue = vi.fn<EnqueueAgentMessage>(async () => true);
const drain = vi.fn(async (_params: unknown) => undefined);
const reportError = vi.fn(async (_params: unknown) => undefined);
type PushBranch = ReturnType<StoryStore['getState']>['pushBranch'];

const push = vi.fn<PushBranch>();

const setChecks = ({ checks }: { readonly checks: PullRequestChecks }): void => {
  act(() => {
    useAppStore.setState({
      mountGithub: {
        [LEDGER_MOUNT]: { ...aMountGithub({ mountId: LEDGER_MOUNT }), pr: prOf({ checks }) },
      },
    });
  });
};

const advance = async ({ ms }: { readonly ms: number }): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const implementer = anAgent({
  sessionId: session.id,
  kind: 'implementer',
  name: 'Implementer',
  status: 'completed',
  ordinal: 1,
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers();
  await resetStoryStore();
  rerunNotes.reset();
  for (const spy of [sweep, enqueue, drain, reportError, push]) {
    spy.mockClear();
  }
  enqueue.mockResolvedValue(true);
  useAppStore.setState({
    sessions: [session],
    sessionBranches: { [session.id]: 'ak/payout-export' },
    sessionMounts: { [session.id]: [mountView] },
    sessionPhaseRuns: { [session.id]: [implementer] },
    mountGithub: {
      [LEDGER_MOUNT]: {
        ...aMountGithub({ mountId: LEDGER_MOUNT }),
        pr: prOf({ checks: 'success' }),
      },
    },
    sweepRequests: sweep,
    enqueueAgentMessage: enqueue,
    drainAgentQueue: drain,
    reportError,
    pushBranch: push,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the adaptive PR watch', () => {
  it('reads every five minutes while no check runs and no check was rerun', async () => {
    renderHook(() => useGithubPolling());
    sweep.mockClear();

    await advance({ ms: WATCH.slowMs - 1 });
    expect(sweep).not.toHaveBeenCalled();

    await advance({ ms: 1 });
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith({ shouldSkipUnknownRequest: true });
  });

  it('reads the session every twenty seconds while a check runs, then goes back to five minutes', async () => {
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    sweep.mockClear();

    await advance({ ms: WATCH.fastMs * 3 });
    expect(sweep).toHaveBeenCalledTimes(3);
    expect(sweep).toHaveBeenCalledWith({ sessionId: session.id });

    setChecks({ checks: 'success' });
    sweep.mockClear();
    await advance({ ms: WATCH.slowMs - WATCH.fastMs * 3 - 1 });
    expect(sweep).not.toHaveBeenCalled();
  });

  it('reads every twenty seconds for a short while after a rerun, then stops', async () => {
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'failure' });
    sweep.mockClear();
    await advance({ ms: WATCH.fastMs * 2 });
    expect(sweep).not.toHaveBeenCalled();

    act(() => {
      rerunNotes.note({ mountId: LEDGER_MOUNT, at: Date.now() });
    });
    await advance({ ms: WATCH.fastMs * 2 });
    expect(sweep).toHaveBeenCalledTimes(2);

    sweep.mockClear();
    await advance({ ms: WATCH.rerunGraceMs });
    const during = sweep.mock.calls.length;
    sweep.mockClear();
    await advance({ ms: WATCH.fastMs * 3 });
    expect(during).toBeGreaterThan(0);
    expect(sweep).not.toHaveBeenCalled();
  });

  it('never watches a request that merged', async () => {
    renderHook(() => useGithubPolling());
    act(() => {
      useAppStore.setState({
        mountGithub: {
          [LEDGER_MOUNT]: {
            ...aMountGithub({ mountId: LEDGER_MOUNT }),
            pr: prOf({ checks: 'pending', state: 'merged' }),
          },
        },
      });
    });
    sweep.mockClear();
    await advance({ ms: WATCH.fastMs * 3 });
    expect(sweep).not.toHaveBeenCalled();
  });

  it('leaves the old state in place when a read fails, and backs off after three failed reads', async () => {
    const failing = vi.fn(async () => {
      useAppStore.setState({
        mountGithub: {
          [LEDGER_MOUNT]: {
            ...aMountGithub({ mountId: LEDGER_MOUNT }),
            pr: prOf({ checks: 'pending' }),
            failedAt: brandId<IsoDateTime>({ value: new Date(Date.now() + 1).toISOString() }),
          },
        },
      });
    });
    useAppStore.setState({ sweepRequests: failing });
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    failing.mockClear();

    for (let tick = 0; tick < 6; tick += 1) {
      await advance({ ms: WATCH.fastMs });
    }

    expect(failing).toHaveBeenCalledTimes(WATCH.maxFailedReads);
    const entry = useAppStore.getState().mountGithub[LEDGER_MOUNT];
    expect(entry?.pr?.checks).toBe('pending');
    expect(entry?.failedAt).not.toBeNull();
  });

  it('drops a tick while the previous read is still running', async () => {
    let release: () => void = () => undefined;
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    useAppStore.setState({ sweepRequests: slow });
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    slow.mockClear();

    await advance({ ms: WATCH.fastMs * 3 });
    expect(slow).toHaveBeenCalledTimes(1);

    release();
    await advance({ ms: WATCH.fastMs });
    expect(slow).toHaveBeenCalledTimes(2);
  });
});

describe('waking the Implementer on a failed check', () => {
  it('queues one message for the Implementer and drains its queue when a watched check fails', async () => {
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    setChecks({ checks: 'failure' });
    await advance({ ms: 0 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const turn = enqueue.mock.calls[0]?.[0].turn;
    expect(turn?.agentId).toBe(implementer.id);
    expect(turn?.content).toContain('#418');
    expect(turn?.content).toContain("Don't push");
    expect(drain).toHaveBeenCalledWith({ sessionId: session.id, agentId: implementer.id });
  });

  it('never pushes, whatever the checks do', async () => {
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    setChecks({ checks: 'failure' });
    setChecks({ checks: 'pending' });
    setChecks({ checks: 'success' });
    await advance({ ms: WATCH.slowMs });

    expect(push).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not wake on a failure it did not watch begin', async () => {
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'failure' });
    await advance({ ms: 0 });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('stops after the allowed number of wakes on one request', async () => {
    renderHook(() => useGithubPolling());
    for (let round = 0; round < WATCH.maxWakes + 2; round += 1) {
      setChecks({ checks: 'pending' });
      setChecks({ checks: 'failure' });
      await advance({ ms: 0 });
    }

    expect(enqueue).toHaveBeenCalledTimes(WATCH.maxWakes);
  });

  it('wakes no one when no Implementer can take the message', async () => {
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [{ ...implementer, status: 'stopped' }] },
    });
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    setChecks({ checks: 'failure' });
    await advance({ ms: 0 });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('says so and does not count the wake when the message could not be saved, then tries again on the next failure', async () => {
    enqueue.mockResolvedValueOnce(false);
    renderHook(() => useGithubPolling());
    setChecks({ checks: 'pending' });
    setChecks({ checks: 'failure' });
    await advance({ ms: 0 });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(drain).not.toHaveBeenCalled();

    setChecks({ checks: 'pending' });
    setChecks({ checks: 'failure' });
    await advance({ ms: 0 });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(drain).toHaveBeenCalledTimes(1);
  });
});
