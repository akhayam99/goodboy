import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { MountId, SessionId } from '@goodboy/types';
import { createReviewNavigationSlice } from './index';
import { reviewNavigationInitialState } from './state';
import type { ReviewDestination } from './destination';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;

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

const createHarness = () => {
  const calls: Array<string> = [];
  const mountGates: Array<() => void> = [];
  const state = {
    ...reviewNavigationInitialState,
    sessions: [{ id: SESSION_ID }, { id: OTHER_SESSION_ID }],
    sessionMounts: {},
    sessionProjectMounts: {},
    sessionActiveMount: {},
    sessionActiveProject: {},
    sessionSelectedPrNumber: {} as Record<string, number | null>,
    mountGithub: { [MOUNT_ID]: { prs: [{ number: 248 }, { number: 12 }] } } as Record<
      string,
      { prs: ReadonlyArray<{ number: number }> }
    >,
    sessionGithub: {} as Record<string, { pr: { number: number } | null }>,
    setSessionActiveMount: vi.fn(async () => {
      calls.push('mount');
    }),
    refreshSessionPr: vi.fn(async () => {
      calls.push('prs');
    }),
    selectSessionPr: vi.fn(async () => {
      calls.push('pr');
    }),
    refreshSessionPrDetail: vi.fn(async () => {
      calls.push('refresh');
    }),
    loadResolveSession: vi.fn(async () => {
      calls.push('resolve');
    }),
    ensureReviewThread: vi.fn(async (params: { readonly isCancelled?: () => boolean }) => {
      void params;
      calls.push('thread');
      return 'created' as const;
    }),
    setActiveLens: vi.fn(() => {
      calls.push('lens');
    }),
  };
  const store = createStore(() => state);
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  const actions = createReviewNavigationSlice({ set, get });
  store.setState({ ...actions } as never);
  const seePr = (sessionGithub: Record<string, { pr: { number: number } | null }>): void => {
    store.setState({ sessionGithub } as never);
  };
  const holdMounts = (): void => {
    state.setSessionActiveMount.mockImplementation(async () => {
      calls.push('mount');
      await new Promise<void>((resolve) => {
        mountGates.push(resolve);
      });
    });
  };
  return { store, state, calls: calls as Calls, actions, get, seePr, holdMounts, mountGates };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('the review navigation target', () => {
  it('activates the mount, waits for the pull request, then opens the lens', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });

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
    live.store.setState({ mountGithub: {} } as never);
    live.state.refreshSessionPr.mockImplementation(async () => {
      live.store.setState({
        mountGithub: { [MOUNT_ID]: { prs: [{ number: 248 }] } },
        sessionGithub: { [SESSION_ID]: { pr: { number: 248 } } },
      } as never);
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
    live.seePr({ [SESSION_ID]: { pr: { number: 300 } } });
    live.store.setState({ sessionSelectedPrNumber: { [SESSION_ID]: 248 } } as never);

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
    expect(live.state.setActiveLens).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID] ?? null).toBeNull();
  });

  it('opens the review home with no target when the caller names none', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({ sessionId: SESSION_ID });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.state.selectSessionPr).not.toHaveBeenCalled();
    expect(live.state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'review');
    expect(live.get().reviewTargets[SESSION_ID]?.destination).toEqual({ kind: 'home' });
  });

  it('lands on review with the pull request marked unavailable instead of guessing another', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 12 } } });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_pull_request' });
    expect(live.state.ensureReviewThread).not.toHaveBeenCalled();
    expect(live.get().reviewTargets[SESSION_ID]?.status).toBe('unavailable');
    expect(live.state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'review');
  });

  it('keeps the queue open with no selection when the thread is gone', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
    live.state.ensureReviewThread.mockResolvedValueOnce('missing' as never);

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
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
    live.state.ensureReviewThread.mockResolvedValueOnce('closed' as never);

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
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
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
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
    live.state.ensureReviewThread.mockResolvedValueOnce('cancelled' as never);

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      destination: onThread({ threadId: 'PRRT_1' }),
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'superseded' });
    expect(live.state.setActiveLens).not.toHaveBeenCalled();
  });

  it('keeps a remote failure on the target so the surface can retry it', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
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
      [SESSION_ID]: { pr: { number: 248 } },
      [OTHER_SESSION_ID]: { pr: { number: 12 } },
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
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });

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
    expect(live.state.setActiveLens).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest navigation even when mount activation finishes out of order', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
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
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
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
