// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { MountId, ProjectId, PullRequestState, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { MountGithubState, SessionGithubState } from '../../types';
import { branchPlace } from '../navigation/place';
import { createReviewNavigationSlice } from './index';
import { reviewNavigationInitialState } from './state';
import { createReviewSelectionSlice } from '../review-selection';
import { reviewSelectionInitialState } from '../review-selection/state';
import { reviewFocusThreadId, type ReviewDestination } from './destination';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;
const PROJECT_ID = 'project-1' as ProjectId;

type Calls = ReadonlyArray<string>;

type ThreadParams = {
  readonly threadId: string;
  readonly prNumber?: number;
};

const onThread = ({ threadId, prNumber = 248 }: ThreadParams): ReviewDestination => ({
  kind: 'thread',
  mountId: MOUNT_ID,
  prNumber,
  threadId,
});

const pullRequestOf = (number: number): PullRequestState => ({
  number,
  title: 'Guard the settlement batch',
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'fix/ledger-postings',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-25T00:00:00.000Z',
});

const githubWithPr = (number: number): SessionGithubState => ({
  pr: pullRequestOf(number),
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const mountGithubWith = (numbers: ReadonlyArray<number>): MountGithubState => ({
  ...githubWithPr(numbers[0] ?? 0),
  pr: null,
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'harborline/ledger-core',
  host: 'github.com',
  branch: 'fix/ledger-postings',
  prs: numbers.map(pullRequestOf),
  links: [],
});

const createHarness = () => {
  const calls: Array<string> = [];
  const mountGates: Array<() => void> = [];
  const mocks = {
    setSessionActiveMount: vi.fn<AppStore['setSessionActiveMount']>(async () => {
      calls.push('mount');
    }),
    refreshSessionPr: vi.fn<AppStore['refreshSessionPr']>(async () => {
      calls.push('prs');
    }),
    selectSessionPr: vi.fn<AppStore['selectSessionPr']>(async () => {
      calls.push('pr');
    }),
    refreshSessionPrDetail: vi.fn<AppStore['refreshSessionPrDetail']>(async () => {
      calls.push('refresh');
    }),
    loadResolveSession: vi.fn<AppStore['loadResolveSession']>(async () => {
      calls.push('resolve');
    }),
    ensureReviewThread: vi.fn<AppStore['ensureReviewThread']>(async () => {
      calls.push('thread');
      return 'created';
    }),
    navigate: vi.fn<AppStore['navigate']>(() => {
      calls.push('lens');
    }),
  };
  const store = createStore<AppStore>((set, get) => ({
    ...useAppStore.getInitialState(),
    ...reviewNavigationInitialState,
    ...reviewSelectionInitialState,
    sessions: [aSession({ id: SESSION_ID }), aSession({ id: OTHER_SESSION_ID })],
    sessionMounts: {},
    sessionProjectMounts: {},
    sessionActiveMount: {},
    sessionActiveProject: {},
    sessionSelectedPrNumber: {},
    mountGithub: { [MOUNT_ID]: mountGithubWith([248, 12]) },
    sessionGithub: {},
    ...mocks,
    ...createReviewNavigationSlice({ set, get }),
    ...createReviewSelectionSlice({ set, get }),
  }));
  const actions = store.getState();
  const seePr = (sessionGithub: Record<SessionId, SessionGithubState>): void => {
    store.setState({ sessionGithub });
  };
  const holdMounts = (): void => {
    mocks.setSessionActiveMount.mockImplementation(async () => {
      calls.push('mount');
      await new Promise<void>((resolve) => {
        mountGates.push(resolve);
      });
    });
  };
  return {
    store,
    state: mocks,
    calls: calls as Calls,
    actions,
    get: store.getState,
    seePr,
    holdMounts,
    mountGates,
  };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('the review navigation target', () => {
  it('activates the mount, waits for the pull request, then opens the lens', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.calls).toEqual(['mount', 'pr', 'refresh', 'resolve', 'thread', 'lens']);
    expect(live.state.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 248, MOUNT_ID);
  });

  it('loads the pull requests of a cold mount before selecting one of them', async () => {
    const live = createHarness();
    live.store.setState({ mountGithub: {} });
    live.state.refreshSessionPr.mockImplementation(async () => {
      live.store.setState({
        mountGithub: { [MOUNT_ID]: mountGithubWith([248]) },
        sessionGithub: { [SESSION_ID]: githubWithPr(248) },
      });
    });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: MOUNT_ID,
    });
    expect(live.state.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 248, MOUNT_ID);
  });

  it('accepts a pull request the session selected over its branch pull request', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(300) });
    live.store.setState({ sessionSelectedPrNumber: { [SESSION_ID]: 248 } });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'opened' });
  });

  it('refuses a thread when the session has no mount to resolve it against', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: null, prNumber: 248, threadId: 'PRRT_1' },
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_mount' });
    expect(live.state.navigate).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID] ?? null).toBeNull();
  });

  it('opens the review home with no target when the caller names none', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({ sessionId: SESSION_ID });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.state.selectSessionPr).not.toHaveBeenCalled();
    expect(live.state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'comments' }),
    });
    expect(live.get().reviewTargets[SESSION_ID]?.destination).toEqual({ kind: 'home' });
  });

  it('opens a pull request on its own page, not on Review', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'pull_request', mountId: MOUNT_ID, prNumber: 248 },
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.state.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 248, MOUNT_ID);
    expect(live.state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'comments' }),
    });
    expect(live.state.navigate).toHaveBeenCalledTimes(1);
    expect(live.get().reviewTargets[SESSION_ID] ?? null).toBeNull();
  });

  it('opens the comments of a pull request in Review, with that pull request selected', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'comments', mountId: MOUNT_ID, prNumber: 248 },
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.state.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 248, MOUNT_ID);
    expect(live.state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'comments' }),
    });
  });

  it('stays in place and reports a pull request it cannot show', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(12) });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'pull_request', mountId: MOUNT_ID, prNumber: 248 },
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_pull_request' });
    expect(live.state.navigate).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID] ?? null).toBeNull();
  });

  it('lands on review with the pull request marked unavailable instead of guessing another', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(12) });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_pull_request' });
    expect(live.state.ensureReviewThread).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID]?.status).toBe('unavailable');
    expect(live.state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'comments' }),
    });
  });

  it('keeps the queue open with no selection when the thread is gone', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    live.state.ensureReviewThread.mockResolvedValueOnce('missing');

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_9' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_thread' });
    expect(live.get().reviewTargets[SESSION_ID]).toMatchObject({
      status: 'unavailable',
      reason: 'no_thread',
      destination: { threadId: 'PRRT_9' },
    });
  });

  it('reports a closed comment the queue cannot carry instead of settling on nothing', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    live.state.ensureReviewThread.mockResolvedValueOnce('closed');

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_9' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'thread_closed' });
    expect(live.get().reviewTargets[SESSION_ID]).toMatchObject({
      status: 'unavailable',
      reason: 'thread_closed',
    });
  });

  it('hands materialization a way to see that a newer request took over', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    const seen: { current: (() => boolean) | null } = { current: null };
    live.state.ensureReviewThread.mockImplementation(
      async ({ isCancelled }: { readonly isCancelled?: () => boolean }) => {
        seen.current = seen.current ?? isCancelled ?? null;
        return 'created' as const;
      },
    );

    await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });
    expect(seen.current).not.toBeNull();
    expect(seen.current?.()).toBe(false);

    await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_2' }),
    });
    expect(seen.current?.()).toBe(true);
  });

  it('abandons a request whose materialization reports itself superseded', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    live.state.ensureReviewThread.mockResolvedValueOnce('cancelled');

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'superseded' });
    expect(live.state.navigate).not.toHaveBeenCalled();
  });

  it('keeps a remote failure on the target so the surface can retry it', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    live.state.refreshSessionPrDetail.mockRejectedValueOnce(new Error('network is down'));

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'failed', error: 'network is down' });
    expect(live.get().reviewTargets[SESSION_ID]).toMatchObject({
      status: 'failed',
      error: 'network is down',
    });
  });

  it('keeps one session target from overwriting another', async () => {
    const live = createHarness();
    live.seePr({
      [SESSION_ID]: githubWithPr(248),
      [OTHER_SESSION_ID]: githubWithPr(12),
    });

    await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });
    await live.actions.openReviewTarget({
      sessionId: OTHER_SESSION_ID,
      destination: onThread({ threadId: 'PRRT_2', prNumber: 12 }),
    });

    expect(live.get().reviewTargets[SESSION_ID]?.destination).toMatchObject({
      threadId: 'PRRT_1',
    });
    expect(live.get().reviewTargets[OTHER_SESSION_ID]?.destination).toMatchObject({
      threadId: 'PRRT_2',
    });
  });

  it('lets only the most recent navigation of a session settle', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });

    const first = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });
    const second = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_2' }),
    });

    expect(await second).toEqual({ kind: 'opened' });
    expect(await first).toEqual({ kind: 'unavailable', reason: 'superseded' });
    expect(live.get().reviewTargets[SESSION_ID]?.destination).toMatchObject({
      threadId: 'PRRT_2',
    });
    expect(live.state.navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest navigation even when mount activation finishes out of order', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    live.holdMounts();

    const first = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });
    const second = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_2' }),
    });

    live.mountGates[1]?.();
    expect(await second).toEqual({ kind: 'opened' });

    live.mountGates[0]?.();
    expect(await first).toEqual({ kind: 'unavailable', reason: 'superseded' });
    expect(live.get().reviewTargets[SESSION_ID]?.destination).toMatchObject({
      threadId: 'PRRT_2',
    });
  });

  it('releases a target only for the request that owns it', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: githubWithPr(248) });
    await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });
    const owned = live.get().reviewTargets[SESSION_ID]?.requestId ?? '';

    live.actions.consumeReviewTarget({ sessionId: SESSION_ID, requestId: 'someone-else' });
    expect(live.get().reviewTargets[SESSION_ID]).not.toBeNull();

    live.actions.consumeReviewTarget({ sessionId: SESSION_ID, requestId: owned });
    expect(live.get().reviewTargets[SESSION_ID]).toBeNull();
  });
});

describe('a destination made of several threads', () => {
  const threads: ReviewDestination = {
    kind: 'threads',
    mountId: null,
    threadIds: ['PRRT_1', 'PRRT_2', 'PRRT_1', 'PRRT_3'],
  };

  it('opens the lens without a mount or a pull request round trip and keeps the set', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: threads,
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.calls).toEqual(['lens']);
    expect(live.state.setSessionActiveMount).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID]).toMatchObject({
      status: 'ready',
      destination: threads,
    });
    expect(live.get().reviewSelection[SESSION_ID]).toEqual(['PRRT_1', 'PRRT_2', 'PRRT_3']);
  });

  it('switches to the mount of the batch before it opens the lens', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: { ...threads, mountId: MOUNT_ID },
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.calls).toEqual(['mount', 'lens']);
    expect(live.state.setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('answers with the first thread that is present and none when nothing matches', () => {
    expect(reviewFocusThreadId({ destination: threads })).toBe('PRRT_1');
    expect(reviewFocusThreadId({ destination: threads, isPresent: (id) => id === 'PRRT_3' })).toBe(
      'PRRT_3',
    );
    expect(reviewFocusThreadId({ destination: threads, isPresent: () => false })).toBeNull();
    expect(reviewFocusThreadId({ destination: onThread({ threadId: 'PRRT_9' }) })).toBe('PRRT_9');
    expect(reviewFocusThreadId({ destination: { kind: 'home' } })).toBeNull();
  });

  it('keeps the selection of one session apart from another', async () => {
    const live = createHarness();
    await live.actions.openReviewTarget({ sessionId: SESSION_ID, destination: threads });

    live.get().setReviewSelection({ sessionId: OTHER_SESSION_ID, threadIds: ['PRRT_7'] });

    expect(live.get().reviewSelection[SESSION_ID]).toEqual(['PRRT_1', 'PRRT_2', 'PRRT_3']);
    expect(live.get().reviewSelection[OTHER_SESSION_ID]).toEqual(['PRRT_7']);
  });
});
