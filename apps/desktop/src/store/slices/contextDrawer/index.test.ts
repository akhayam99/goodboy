import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionEvent, SessionId } from '@goodboy/types';

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
import { selectNewDecisionCount } from './selectNewDecisionCount';

const SESSION_ID = 'sess-1' as SessionId;

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

const event = (createdAt: string, added: number): SessionEvent =>
  ({
    id: createdAt,
    sessionId: SESSION_ID,
    kind: 'decisions_changed',
    payload: { added, removed: 0 },
    createdAt,
  }) as unknown as SessionEvent;

let h = harness();

beforeEach(() => {
  h = harness();
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

  it('keeps the previous look as the baseline for the New tags', async () => {
    db.getSessionContextSeenAt.mockResolvedValueOnce('2026-09-26T09:00:00.000Z');

    await h.slice.markSessionContextSeen(SESSION_ID);
    expect(h.getState()['sessionDecisionsBaseline']).toEqual({
      [SESSION_ID]: '2026-09-26T09:00:00.000Z',
    });

    const firstLook = (h.getState()['sessionContextSeenAt'] as Record<string, string>)[SESSION_ID];
    await h.slice.markSessionContextSeen(SESSION_ID);
    expect(h.getState()['sessionDecisionsBaseline']).toEqual({ [SESSION_ID]: firstLook });
  });

  it('writes when the decisions were seen', async () => {
    await h.slice.markSessionContextSeen(SESSION_ID);

    const seenAt = (h.getState()['sessionContextSeenAt'] as Record<string, string>)[SESSION_ID];
    expect(seenAt).toBeDefined();
    expect(db.setSessionContextSeenAt).toHaveBeenCalledWith(SESSION_ID, seenAt);
  });

  it('loads when the decisions were last seen once', async () => {
    db.getSessionContextSeenAt.mockResolvedValueOnce('2026-09-26T10:00:00.000Z');
    await h.slice.loadSessionContextSeen(SESSION_ID);
    await h.slice.loadSessionContextSeen(SESSION_ID);

    expect(h.getState()['sessionContextSeenAt']).toEqual({
      [SESSION_ID]: '2026-09-26T10:00:00.000Z',
    });
  });
});

describe('selectNewDecisionCount', () => {
  const events = [
    event('2026-09-26T09:00:00.000Z', 3),
    event('2026-09-26T11:00:00.000Z', 2),
    { ...event('2026-09-26T12:00:00.000Z', 4), kind: 'issue_linked' } as SessionEvent,
  ];

  it('counts the decisions added after the last look', () => {
    expect(
      selectNewDecisionCount({
        state: {
          sessionEvents: { [SESSION_ID]: events },
          sessionContextSeenAt: { [SESSION_ID]: '2026-09-26T10:00:00.000Z' as IsoDateTime },
        },
        sessionId: SESSION_ID,
      }),
    ).toBe(2);
  });

  it('counts every added decision when the tab was never opened', () => {
    expect(
      selectNewDecisionCount({
        state: {
          sessionEvents: { [SESSION_ID]: events },
          sessionContextSeenAt: { [SESSION_ID]: null },
        },
        sessionId: SESSION_ID,
      }),
    ).toBe(5);
  });

  it('counts replacements as new, never withdrawals', () => {
    const ledgerEvent = {
      ...event('2026-09-26T11:30:00.000Z', 1),
      payload: { added: 1, replaced: 2, withdrawn: 4, merged: 1 },
    } as SessionEvent;
    expect(
      selectNewDecisionCount({
        state: {
          sessionEvents: { [SESSION_ID]: [ledgerEvent] },
          sessionContextSeenAt: { [SESSION_ID]: '2026-09-26T10:00:00.000Z' as IsoDateTime },
        },
        sessionId: SESSION_ID,
      }),
    ).toBe(3);
  });

  it('says nothing before the last look is known', () => {
    expect(
      selectNewDecisionCount({
        state: { sessionEvents: { [SESSION_ID]: events }, sessionContextSeenAt: {} },
        sessionId: SESSION_ID,
      }),
    ).toBe(0);
  });
});
