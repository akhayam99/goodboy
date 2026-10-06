import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { REVIEW_REQUEST_EVENT, requestReview } from './reviewRequest';

const SESSION_ID = 'session-1' as SessionId;

const initial = useAppStore.getState();

afterEach(() => {
  useAppStore.setState(initial, true);
  vi.restoreAllMocks();
});

const fix = (threadIds: ReadonlyArray<string>): void =>
  requestReview({
    getState: useAppStore.getState,
    sessionId: SESSION_ID,
    request: { kind: 'fix', threadIds },
  });

describe('requestReview with a fix request', () => {
  it('writes a pending launch request to the store and raises no window event', () => {
    const listener = vi.fn();
    window.addEventListener(REVIEW_REQUEST_EVENT, listener);
    useAppStore.setState({ navigate: vi.fn() });

    fix(['PRRT_1', 'PRRT_2']);

    window.removeEventListener(REVIEW_REQUEST_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
    expect(useAppStore.getState().reviewLaunchRequests[SESSION_ID]?.threadIds).toEqual([
      'PRRT_1',
      'PRRT_2',
    ]);
  });

  it('stays put when the Comments tab of that session is already open', () => {
    const navigate = vi.fn();
    useAppStore.setState({
      navigate,
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: 'branch' },
      branchTab: { [SESSION_ID]: 'comments' },
    });

    fix(['PRRT_1']);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the Comments tab on the thread it already had when it was somewhere else', () => {
    const navigate = vi.fn();
    useAppStore.setState({
      navigate,
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: 'branch' },
      branchTab: { [SESSION_ID]: 'files' },
      branchThreadId: { [SESSION_ID]: 'PRRT_open' },
    });

    fix(['PRRT_1']);

    expect(navigate).toHaveBeenCalledOnce();
    const [call] = navigate.mock.calls[0] ?? [];
    expect(call?.to).toMatchObject({
      at: 'session',
      sessionId: SESSION_ID,
      view: { target: { kind: 'branch', tab: 'comments', threadId: 'PRRT_open' } },
    });
  });
});
