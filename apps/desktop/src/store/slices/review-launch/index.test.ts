import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store';
import { createReviewLaunchSlice } from './index';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_ID = 'session-2' as SessionId;

const harness = () =>
  createStore<AppStore>((set, get) => ({
    ...useAppStore.getInitialState(),
    ...createReviewLaunchSlice({ set, get }),
  }));

describe('review launch slice', () => {
  it('holds a pending request per session with deduped thread ids', () => {
    const store = harness();
    store.getState().requestReviewLaunch({ sessionId: SESSION_ID, threadIds: ['a', 'a', 'b'] });
    store.getState().requestReviewLaunch({ sessionId: OTHER_ID, threadIds: ['c'] });
    expect(store.getState().reviewLaunchRequests[SESSION_ID]?.threadIds).toEqual(['a', 'b']);
    expect(store.getState().reviewLaunchRequests[OTHER_ID]?.threadIds).toEqual(['c']);
  });

  it('consumes only the request it was given', () => {
    const store = harness();
    store.getState().requestReviewLaunch({ sessionId: SESSION_ID, threadIds: ['a'] });
    const first = store.getState().reviewLaunchRequests[SESSION_ID];
    store.getState().requestReviewLaunch({ sessionId: SESSION_ID, threadIds: ['b'] });
    store
      .getState()
      .consumeReviewLaunch({ sessionId: SESSION_ID, requestId: first?.requestId ?? '' });
    const second = store.getState().reviewLaunchRequests[SESSION_ID];
    expect(second?.threadIds).toEqual(['b']);
    store
      .getState()
      .consumeReviewLaunch({ sessionId: SESSION_ID, requestId: second?.requestId ?? '' });
    expect(store.getState().reviewLaunchRequests[SESSION_ID]).toBeNull();
  });
});
