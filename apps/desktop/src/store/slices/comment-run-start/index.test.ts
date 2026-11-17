import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store';
import { createCommentRunStartSlice } from './index';

const SESSION_ID = 'session-ledger-core' as SessionId;
const OTHER_ID = 'session-payments-api' as SessionId;
const HEADER = 'note:note-ledger-header';
const FILTERS = 'PRRT_harborline_ledger_filters';

const harness = () =>
  createStore<AppStore>((set, get) => ({
    ...useAppStore.getInitialState(),
    ...createCommentRunStartSlice({ set, get }),
  }));

describe('comment run start slice', () => {
  it('opens the form for one comment of one session', () => {
    const store = harness();
    store.getState().openCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    expect(store.getState().commentRunStarts[SESSION_ID]?.openThreadId).toBe(HEADER);
    expect(store.getState().commentRunStarts[OTHER_ID]).toBeUndefined();
  });

  it('keeps the goal and the extra comments after Cancel, and shows them on the next open', () => {
    const store = harness();
    store.getState().openCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    store.getState().setCommentRunExtras({
      sessionId: SESSION_ID,
      threadId: HEADER,
      extraThreadIds: [FILTERS, FILTERS],
    });
    store
      .getState()
      .closeCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER, goal: 'Move the header' });
    expect(store.getState().commentRunStarts[SESSION_ID]).toEqual({
      openThreadId: null,
      drafts: { [HEADER]: { goal: 'Move the header', extraThreadIds: [FILTERS] } },
    });
    store.getState().openCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    expect(store.getState().commentRunStarts[SESSION_ID]?.drafts[HEADER]?.goal).toBe(
      'Move the header',
    );
  });

  it('remembers the goal of an open form only, so a late unmount never revives a started one', () => {
    const store = harness();
    store.getState().keepCommentRunGoal({ sessionId: SESSION_ID, threadId: HEADER, goal: 'late' });
    expect(store.getState().commentRunStarts[SESSION_ID]).toBeUndefined();
    store.getState().openCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    store.getState().keepCommentRunGoal({ sessionId: SESSION_ID, threadId: HEADER, goal: 'kept' });
    store.getState().finishCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    store.getState().keepCommentRunGoal({ sessionId: SESSION_ID, threadId: HEADER, goal: 'late' });
    expect(store.getState().commentRunStarts[SESSION_ID]).toEqual({
      openThreadId: null,
      drafts: {},
    });
  });

  it('finishes only the comment it names, leaving the form open on another one', () => {
    const store = harness();
    store
      .getState()
      .closeCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER, goal: 'Move the header' });
    store.getState().openCommentRunStart({ sessionId: SESSION_ID, threadId: FILTERS });
    store.getState().finishCommentRunStart({ sessionId: SESSION_ID, threadId: HEADER });
    expect(store.getState().commentRunStarts[SESSION_ID]).toEqual({
      openThreadId: FILTERS,
      drafts: {},
    });
  });
});
