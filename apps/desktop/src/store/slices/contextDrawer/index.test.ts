// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';

const { db } = vi.hoisted(() => ({
  db: {
    getSessionContextSeenAt: vi.fn(async (): Promise<string | null> => null),
    setSessionContextSeenAt: vi.fn(async (_sessionId: unknown, _seenAt: unknown) => undefined),
  },
}));

vi.mock('@goodboy/db', () => ({
  getSessionContextSeenAt: () => db.getSessionContextSeenAt(),
  setSessionContextSeenAt: (_db: unknown, sessionId: unknown, seenAt: unknown) =>
    db.setSessionContextSeenAt(sessionId, seenAt),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { createContextDrawerSlice } from './index';
import { initialContextDrawerState } from './state';
import { decisionChangesSince, NO_DECISION_CHANGES } from './decisionChangesSince';
import { selectHasContextChange } from './selectHasContextChange';

const SESSION_ID = 'sess-1' as SessionId;
const SEEN_AT = '2026-09-26T10:00:00.000Z' as IsoDateTime;
const BEFORE = '2026-09-26T09:00:00.000Z' as IsoDateTime;
const AFTER = '2026-09-26T11:00:00.000Z' as IsoDateTime;

type HarnessState = Record<string, unknown>;

const harness = () => {
  let state: HarnessState = {
    ...initialContextDrawerState,
    sessionDecisionsBaseline: {},
    drawer: null,
    currentSessionId: SESSION_ID,
    openDrawer: vi.fn((request: unknown) => {
      state = { ...state, drawer: request };
    }),
    closeDrawer: vi.fn(() => {
      state = { ...state, drawer: null };
    }),
  };
  const set = (patch: HarnessState | ((s: HarnessState) => HarnessState)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => ({ ...state, ...slice });
  const slice = createContextDrawerSlice(set as never, get as never);
  return { slice, getState: () => state };
};

const decision = (
  row: Partial<SessionDecision> & { readonly number: number },
): SessionDecision => ({
  id: `d-${row.number}`,
  sessionId: SESSION_ID,
  text: `Decision ${row.number}`,
  why: null,
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: null,
  turnOrdinal: 1,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: BEFORE,
  updatedAt: BEFORE,
  ...row,
});

let h = harness();

beforeEach(() => {
  h = harness();
  db.getSessionContextSeenAt.mockClear();
  db.setSessionContextSeenAt.mockClear();
});

describe('context drawer slice', () => {
  it('opens on Summary the first time and remembers the last tab', () => {
    h.slice.openContextDrawer({ sessionId: SESSION_ID });
    expect(h.getState()['drawer']).toEqual({
      kind: 'context',
      sessionId: SESSION_ID,
      payload: { tab: 'summary', view: 'current' },
    });

    h.slice.openContextDrawer({ sessionId: SESSION_ID, tab: 'goal' });
    h.slice.toggleContextDrawer({ sessionId: SESSION_ID });
    expect(h.getState()['drawer']).toBeNull();

    h.slice.toggleContextDrawer({ sessionId: SESSION_ID });
    expect(h.getState()['drawer']).toMatchObject({ payload: { tab: 'goal' } });
  });

  it('carries the rows to highlight when Activity opens it', () => {
    h.slice.openContextDrawer({ sessionId: SESSION_ID, tab: 'decisions', highlight: [5, 7] });

    expect(h.getState()['drawer']).toMatchObject({
      payload: { tab: 'decisions', view: 'current', highlight: [5, 7] },
    });
  });

  it('switches tab instead of closing when another tab is asked for', () => {
    h.slice.openContextDrawer({ sessionId: SESSION_ID, tab: 'summary' });
    h.slice.toggleContextDrawer({ sessionId: SESSION_ID, tab: 'decisions' });

    expect(h.getState()['drawer']).toMatchObject({ payload: { tab: 'decisions' } });
  });

  it('keeps the previous look as the baseline for the change marks while open', async () => {
    db.getSessionContextSeenAt.mockResolvedValueOnce(BEFORE);
    await h.slice.loadSessionContextSeen(SESSION_ID);

    h.slice.openContextDrawer({ sessionId: SESSION_ID, tab: 'decisions' });
    await h.slice.markSessionContextSeen(SESSION_ID);
    expect(h.getState()['sessionDecisionsBaseline']).toEqual({ [SESSION_ID]: BEFORE });

    h.slice.openContextDrawer({ sessionId: SESSION_ID, tab: 'goal' });
    expect(h.getState()['sessionDecisionsBaseline']).toEqual({ [SESSION_ID]: BEFORE });

    const firstLook = (h.getState()['sessionContextSeenAt'] as Record<string, string>)[SESSION_ID];
    h.slice.toggleContextDrawer({ sessionId: SESSION_ID });
    h.slice.openContextDrawer({ sessionId: SESSION_ID });
    expect(h.getState()['sessionDecisionsBaseline']).toEqual({ [SESSION_ID]: firstLook });
  });

  it('writes when the context was seen', async () => {
    await h.slice.markSessionContextSeen(SESSION_ID);

    const seenAt = (h.getState()['sessionContextSeenAt'] as Record<string, string>)[SESSION_ID];
    expect(seenAt).toBeDefined();
    expect(db.setSessionContextSeenAt).toHaveBeenCalledWith(SESSION_ID, seenAt);
  });

  it('loads when the context was last seen once', async () => {
    db.getSessionContextSeenAt.mockResolvedValueOnce(SEEN_AT);
    await h.slice.loadSessionContextSeen(SESSION_ID);
    await h.slice.loadSessionContextSeen(SESSION_ID);

    expect(h.getState()['sessionContextSeenAt']).toEqual({ [SESSION_ID]: SEEN_AT });
    expect(db.getSessionContextSeenAt).toHaveBeenCalledTimes(1);
    expect(db.setSessionContextSeenAt).not.toHaveBeenCalled();
  });

  it('starts the baseline now for a session never looked at, so old rows are not new', async () => {
    db.getSessionContextSeenAt.mockResolvedValueOnce(null);
    await h.slice.loadSessionContextSeen(SESSION_ID);

    const seenAt = (h.getState()['sessionContextSeenAt'] as Record<string, string | null>)[
      SESSION_ID
    ];
    expect(typeof seenAt).toBe('string');
    expect(db.setSessionContextSeenAt).toHaveBeenCalledWith(SESSION_ID, seenAt);
  });
});

describe('decisionChangesSince', () => {
  it('lists added, removed and reworded rows after the last look', () => {
    const ledger = [
      decision({ number: 1 }),
      decision({ number: 2, createdAt: AFTER, updatedAt: AFTER }),
      decision({
        number: 3,
        status: 'replaced',
        replacedBy: 2,
        closedBy: 'agent',
        updatedAt: AFTER,
      }),
      decision({ number: 4, status: 'withdrawn', closedBy: 'summarizer', updatedAt: AFTER }),
      decision({ number: 5, previousText: 'Old', rewordedAt: AFTER, updatedAt: AFTER }),
    ];

    const changes = decisionChangesSince({ ledger, since: SEEN_AT });

    expect(changes.added.map((row) => row.number)).toEqual([2]);
    expect(changes.removed.map((row) => row.number)).toEqual([3, 4]);
    expect(changes.reworded.map((row) => row.number)).toEqual([5]);
  });

  it('leaves out what you did yourself and what came and went unseen', () => {
    const ledger = [
      decision({ number: 1, author: 'user', createdAt: AFTER, updatedAt: AFTER }),
      decision({ number: 2, status: 'withdrawn', closedBy: 'user', updatedAt: AFTER }),
      decision({
        number: 3,
        status: 'withdrawn',
        closedBy: 'agent',
        createdAt: AFTER,
        updatedAt: AFTER,
      }),
      decision({ number: 4, status: 'withdrawn', closedBy: 'agent', updatedAt: BEFORE }),
    ];

    expect(decisionChangesSince({ ledger, since: SEEN_AT })).toBe(NO_DECISION_CHANGES);
  });

  it('says nothing before the last look is known', () => {
    const ledger = [decision({ number: 1, createdAt: AFTER })];

    expect(decisionChangesSince({ ledger, since: undefined })).toBe(NO_DECISION_CHANGES);
    expect(decisionChangesSince({ ledger, since: null })).toBe(NO_DECISION_CHANGES);
    expect(decisionChangesSince({ ledger: undefined, since: SEEN_AT })).toBe(NO_DECISION_CHANGES);
  });

  it('signals a change only when one happened after the last look', () => {
    const quiet = [decision({ number: 1 })];
    const changed = [...quiet, decision({ number: 2, createdAt: AFTER })];
    const state = (ledger: ReadonlyArray<SessionDecision>) => ({
      sessionDecisions: { [SESSION_ID]: ledger },
      sessionContextSeenAt: { [SESSION_ID]: SEEN_AT },
    });

    expect(selectHasContextChange({ state: state(quiet), sessionId: SESSION_ID })).toBe(false);
    expect(selectHasContextChange({ state: state(changed), sessionId: SESSION_ID })).toBe(true);
  });
});
