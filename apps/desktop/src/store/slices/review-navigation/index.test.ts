import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { MountId, SessionId } from '@goodboy/types';
import { createReviewNavigationSlice } from './index';
import { reviewNavigationInitialState } from './state';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;

type Calls = ReadonlyArray<string>;

const createHarness = () => {
  const calls: Array<string> = [];
  const state = {
    ...reviewNavigationInitialState,
    sessions: [{ id: SESSION_ID }, { id: OTHER_SESSION_ID }],
    sessionMounts: {},
    sessionProjectMounts: {},
    sessionActiveMount: {},
    sessionActiveProject: {},
    sessionGithub: {} as Record<string, { pr: { number: number } | null }>,
    setSessionActiveMount: vi.fn(async () => {
      calls.push('mount');
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
    ensureReviewThread: vi.fn(async () => {
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
  return { store, state, calls: calls as Calls, actions, get, seePr };
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
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
    });

    expect(outcome).toEqual({ kind: 'opened' });
    expect(live.calls).toEqual(['mount', 'pr', 'refresh', 'resolve', 'thread', 'lens']);
    expect(live.state.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 248, MOUNT_ID);
  });

  it('refuses a thread when the session has no mount to resolve it against', async () => {
    const live = createHarness();

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      threadId: 'PRRT_1',
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
    expect(live.get().reviewTargets[SESSION_ID]?.threadId ?? null).toBeNull();
  });

  it('lands on review with the pull request marked unavailable instead of guessing another', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 12 } } });

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
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
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_9',
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'no_thread' });
    expect(live.get().reviewTargets[SESSION_ID]).toMatchObject({
      status: 'unavailable',
      reason: 'no_thread',
      threadId: 'PRRT_9',
    });
  });

  it('keeps a remote failure on the target so the surface can retry it', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
    live.state.refreshSessionPrDetail.mockRejectedValueOnce(new Error('network is down'));

    const outcome = await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
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
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
    });
    await live.actions.openReviewTarget({
      sessionId: OTHER_SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 12,
      threadId: 'PRRT_2',
    });

    expect(live.get().reviewTargets[SESSION_ID]?.threadId).toBe('PRRT_1');
    expect(live.get().reviewTargets[OTHER_SESSION_ID]?.threadId).toBe('PRRT_2');
  });

  it('lets only the most recent navigation of a session settle', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });

    const first = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
    });
    const second = live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_2',
    });

    expect(await second).toEqual({ kind: 'opened' });
    expect(await first).toEqual({ kind: 'unavailable', reason: 'superseded' });
    expect(live.get().reviewTargets[SESSION_ID]?.threadId).toBe('PRRT_2');
    expect(live.state.setActiveLens).toHaveBeenCalledTimes(1);
  });

  it('releases a target only for the request that owns it', async () => {
    const live = createHarness();
    live.seePr({ [SESSION_ID]: { pr: { number: 248 } } });
    await live.actions.openReviewTarget({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      prNumber: 248,
      threadId: 'PRRT_1',
    });
    const owned = live.get().reviewTargets[SESSION_ID]?.requestId ?? '';

    live.actions.consumeReviewTarget({ sessionId: SESSION_ID, requestId: 'someone-else' });
    expect(live.get().reviewTargets[SESSION_ID]).not.toBeNull();

    live.actions.consumeReviewTarget({ sessionId: SESSION_ID, requestId: owned });
    expect(live.get().reviewTargets[SESSION_ID]).toBeNull();
  });
});
