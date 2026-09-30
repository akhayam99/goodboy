import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { SessionId } from '@goodboy/types';
import { createReviewSelectionSlice } from './index';
import type { ReviewSelectionSlice, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_ID = 'session-2' as SessionId;

const harness = () => {
  const store = createStore<ReviewSelectionSlice>((set) =>
    createReviewSelectionSlice({ set: set as unknown as SetFn }),
  );
  return store;
};

describe('review selection slice', () => {
  it('toggles a thread in and out of the selection', () => {
    const store = harness();
    store.getState().toggleReviewSelection({ sessionId: SESSION_ID, threadId: 'PRRT_1' });
    store.getState().toggleReviewSelection({ sessionId: SESSION_ID, threadId: 'PRRT_2' });
    expect(store.getState().reviewSelection[SESSION_ID]).toEqual(['PRRT_1', 'PRRT_2']);
    store.getState().toggleReviewSelection({ sessionId: SESSION_ID, threadId: 'PRRT_1' });
    expect(store.getState().reviewSelection[SESSION_ID]).toEqual(['PRRT_2']);
  });

  it('keeps each session apart and dedupes a set selection', () => {
    const store = harness();
    store.getState().setReviewSelection({ sessionId: SESSION_ID, threadIds: ['a', 'a', 'b'] });
    store.getState().setReviewSelection({ sessionId: OTHER_ID, threadIds: ['c'] });
    expect(store.getState().reviewSelection[SESSION_ID]).toEqual(['a', 'b']);
    expect(store.getState().reviewSelection[OTHER_ID]).toEqual(['c']);
  });

  it('clears one session and leaves the state object alone when already empty', () => {
    const store = harness();
    store.getState().setReviewSelection({ sessionId: SESSION_ID, threadIds: ['a'] });
    store.getState().clearReviewSelection({ sessionId: SESSION_ID });
    expect(store.getState().reviewSelection[SESSION_ID]).toEqual([]);
    const before = store.getState().reviewSelection;
    store.getState().clearReviewSelection({ sessionId: SESSION_ID });
    expect(store.getState().reviewSelection).toBe(before);
  });
});
