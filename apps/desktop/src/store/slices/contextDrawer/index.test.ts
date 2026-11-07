// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type SessionDecision, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { aDecision } from '../../../test/aDecision';
import { decisionChangesSince, NO_DECISION_CHANGES } from './decisionChangesSince';
import { selectContextBaseline } from './selectContextBaseline';
import { selectHasContextChange } from './selectHasContextChange';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';

const h = vi.hoisted(() => ({
  persistRead: vi.fn(async () => undefined),
  readSeen: vi.fn(async (): Promise<string | null> => null),
}));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    setSessionContextSeenAt: h.persistRead,
    getSessionContextSeenAt: h.readSeen,
  }),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const BEFORE = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
const AFTER = brandId<IsoDateTime>({ value: '2026-11-01T10:00:00.000Z' });
const LATER = brandId<IsoDateTime>({ value: '2026-11-01T11:00:00.000Z' });
let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  h.persistRead.mockReset();
  h.persistRead.mockResolvedValue(undefined);
  h.readSeen.mockReset();
  h.readSeen.mockResolvedValue(null);
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    currentSessionId: SESSION_ID,
    sessionContextSeenAt: { [SESSION_ID]: BEFORE },
    sessionDecisionsBaseline: { [SESSION_ID]: BEFORE },
  });
});

describe('Context drawer state', () => {
  it('opens on Goal each time, while explicit section links and versions keep their target', () => {
    store
      .getState()
      .openContextDrawer({ sessionId: SESSION_ID, section: 'summary', view: 'versions' });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'summary', view: 'versions' },
    });
    store.getState().closeDrawer();
    store.getState().openContextDrawer({ sessionId: SESSION_ID });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'goal', view: 'current' },
    });
    store.getState().toggleContextDrawer({ sessionId: SESSION_ID });
    expect(store.getState().drawer).toBeNull();
    store
      .getState()
      .openContextDrawer({ sessionId: SESSION_ID, section: 'decisions', highlight: [5, 7] });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'decisions', highlight: [5, 7] },
    });
  });

  it('keeps the old marker while saving and moves seen and baseline after success', async () => {
    let finish: () => void = () => undefined;
    h.persistRead.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const saving = store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);
    finish();
    await saving;
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(AFTER);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(AFTER);
  });

  it('keeps the old marker after failure and succeeds on retry', async () => {
    h.persistRead.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER }),
    ).rejects.toThrow('disk full');
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);
    await store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(AFTER);
  });

  it('drops an older read result that arrives after a newer one', async () => {
    let finish: () => void = () => undefined;
    h.persistRead.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const earlier = store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    await store.getState().markContextRead({ sessionId: SESSION_ID, readAt: LATER });
    finish();
    await earlier;
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(LATER);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(LATER);
  });

  it('switches section instead of closing when another section is asked for', () => {
    store.getState().openContextDrawer({ sessionId: SESSION_ID, section: 'summary' });
    store.getState().toggleContextDrawer({ sessionId: SESSION_ID, section: 'decisions' });
    expect(store.getState().drawer).toMatchObject({ payload: { section: 'decisions' } });
  });

  it('keeps the first look as the baseline while open and takes the newer one on the next open', () => {
    store.setState({ sessionDecisionsBaseline: {} });
    store.getState().openContextDrawer({ sessionId: SESSION_ID, section: 'decisions' });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);

    store.setState({ sessionContextSeenAt: { [SESSION_ID]: AFTER } });
    store.getState().openContextDrawer({ sessionId: SESSION_ID, section: 'goal' });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);

    store.getState().toggleContextDrawer({ sessionId: SESSION_ID });
    store.getState().openContextDrawer({ sessionId: SESSION_ID });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(AFTER);
  });

  it('reads the baseline from the last look when the drawer was never opened here', () => {
    store.setState({ sessionDecisionsBaseline: {} });
    expect(selectContextBaseline({ state: store.getState(), sessionId: SESSION_ID })).toBe(BEFORE);
    store.setState({ sessionDecisionsBaseline: { [SESSION_ID]: AFTER } });
    expect(selectContextBaseline({ state: store.getState(), sessionId: SESSION_ID })).toBe(AFTER);
  });

  it('starts the look now for a session never looked at, so old rows are not new', async () => {
    store.setState({ sessionContextSeenAt: {}, sessionDecisionsBaseline: {} });
    await store.getState().loadSessionContextSeen(SESSION_ID);
    const seenAt = store.getState().sessionContextSeenAt[SESSION_ID];
    expect(typeof seenAt).toBe('string');
    expect(h.persistRead).toHaveBeenCalledWith(expect.anything(), SESSION_ID, seenAt);
    await store.getState().loadSessionContextSeen(SESSION_ID);
    expect(h.persistRead).toHaveBeenCalledTimes(1);
  });

  it('takes a read made in another window, marks included', async () => {
    h.readSeen.mockResolvedValueOnce(LATER);
    await store.getState().loadSessionContextSeen(SESSION_ID);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(LATER);
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(LATER);
  });

  it('keeps a newer look of this window when the stored one is older', async () => {
    store.setState({ sessionContextSeenAt: { [SESSION_ID]: LATER } });
    h.readSeen.mockResolvedValueOnce(AFTER);
    await store.getState().loadSessionContextSeen(SESSION_ID);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(LATER);
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);
  });
});

const SEEN_AT = brandId<IsoDateTime>({ value: '2026-09-26T10:00:00.000Z' });
const EARLIER = brandId<IsoDateTime>({ value: '2026-09-26T09:00:00.000Z' });
const NEWER = brandId<IsoDateTime>({ value: '2026-09-26T11:00:00.000Z' });

type RowParams = Partial<SessionDecision> & { readonly number: number };

const row = (params: RowParams): SessionDecision =>
  aDecision({ sessionId: SESSION_ID, createdAt: EARLIER, updatedAt: EARLIER, ...params });

describe('decisionChangesSince', () => {
  it('lists added, removed and reworded rows after the last look', () => {
    const ledger = [
      row({ number: 1 }),
      row({ number: 2, createdAt: NEWER, updatedAt: NEWER }),
      row({ number: 3, status: 'replaced', replacedBy: 2, closedBy: 'agent', updatedAt: NEWER }),
      row({ number: 4, status: 'withdrawn', closedBy: 'summarizer', updatedAt: NEWER }),
      row({ number: 5, previousText: 'Old', rewordedAt: NEWER, updatedAt: NEWER }),
    ];

    const changes = decisionChangesSince({ ledger, since: SEEN_AT });

    expect(changes.added.map((change) => change.number)).toEqual([2]);
    expect(changes.removed.map((change) => change.number)).toEqual([3, 4]);
    expect(changes.reworded.map((change) => change.number)).toEqual([5]);
  });

  it('leaves out what you did yourself and what came and went unseen', () => {
    const ledger = [
      row({ number: 1, author: 'user', createdAt: NEWER, updatedAt: NEWER }),
      row({ number: 2, status: 'withdrawn', closedBy: 'user', updatedAt: NEWER }),
      row({
        number: 3,
        status: 'withdrawn',
        closedBy: 'agent',
        createdAt: NEWER,
        updatedAt: NEWER,
      }),
      row({ number: 4, status: 'withdrawn', closedBy: 'agent', updatedAt: EARLIER }),
    ];

    expect(decisionChangesSince({ ledger, since: SEEN_AT })).toBe(NO_DECISION_CHANGES);
  });

  it('says nothing before the last look is known', () => {
    const ledger = [row({ number: 1, createdAt: NEWER })];

    expect(decisionChangesSince({ ledger, since: undefined })).toBe(NO_DECISION_CHANGES);
    expect(decisionChangesSince({ ledger, since: null })).toBe(NO_DECISION_CHANGES);
    expect(decisionChangesSince({ ledger: undefined, since: SEEN_AT })).toBe(NO_DECISION_CHANGES);
  });

  it('signals a change only when one happened after the last look', () => {
    const quiet = [row({ number: 1 })];
    const changed = [...quiet, row({ number: 2, createdAt: NEWER })];
    const state = (ledger: ReadonlyArray<SessionDecision>) => ({
      sessionDecisions: { [SESSION_ID]: ledger },
      sessionContextSeenAt: { [SESSION_ID]: SEEN_AT },
    });

    expect(selectHasContextChange({ state: state(quiet), sessionId: SESSION_ID })).toBe(false);
    expect(selectHasContextChange({ state: state(changed), sessionId: SESSION_ID })).toBe(true);
  });
});
