import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionEvent, SessionId } from '@goodboy/types';

const { insertSessionEvent, listSessionEvents } = vi.hoisted(() => ({
  insertSessionEvent: vi.fn(async () => undefined),
  listSessionEvents: vi.fn(async () => [] as ReadonlyArray<SessionEvent>),
}));

vi.mock('@goodboy/db', () => ({ insertSessionEvent, listSessionEvents }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import type { AppStore } from '../../store';
import { loadSessionEvents } from './loadSessionEvents';
import { recordSessionEvent } from './recordSessionEvent';

const sessionId = 'session-1' as SessionId;

type StoreShape = {
  sessionEvents: Record<string, ReadonlyArray<SessionEvent> | undefined>;
};

const makeStore = (initial: StoreShape) => {
  let state = initial;
  const set = (patch: unknown) => {
    const next = typeof patch === 'function' ? (patch as (s: StoreShape) => object)(state) : patch;
    state = { ...state, ...(next as Partial<StoreShape>) };
  };
  const get = () => state;
  return {
    set: set as unknown as (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void,
    get: get as unknown as () => AppStore,
    read: () => state,
  };
};

describe('session events slice', () => {
  beforeEach(() => {
    insertSessionEvent.mockClear();
    listSessionEvents.mockClear();
  });

  it('loads a session once and skips a repeat read', async () => {
    const stored: ReadonlyArray<SessionEvent> = [
      {
        id: 'ev-1' as SessionEvent['id'],
        sessionId,
        kind: 'branch_created',
        payload: { branch: 'ak/feat' },
        createdAt: '2026-08-21T10:00:00.000Z' as SessionEvent['createdAt'],
      },
    ];
    listSessionEvents.mockResolvedValue(stored);
    const store = makeStore({ sessionEvents: {} });
    const load = loadSessionEvents(store.set, store.get);

    await load({ sessionId });
    await load({ sessionId });

    expect(listSessionEvents).toHaveBeenCalledTimes(1);
    expect(store.read().sessionEvents[sessionId]).toEqual(stored);
  });

  it('re-reads when forced', async () => {
    const store = makeStore({ sessionEvents: {} });
    const load = loadSessionEvents(store.set, store.get);

    await load({ sessionId });
    await load({ sessionId, force: true });

    expect(listSessionEvents).toHaveBeenCalledTimes(2);
  });

  it('persists a recorded event and appends it to a loaded session', async () => {
    const store = makeStore({ sessionEvents: { [sessionId]: [] } });
    const record = recordSessionEvent(store.set);

    await record({ sessionId, kind: 'pr_created', payload: { number: 7, title: 'Ship it' } });

    expect(insertSessionEvent).toHaveBeenCalledTimes(1);
    const appended = store.read().sessionEvents[sessionId] ?? [];
    expect(appended.map((event) => event.kind)).toEqual(['pr_created']);
    expect(appended[0]?.payload).toEqual({ number: 7, title: 'Ship it' });
  });

  it('keeps an unloaded session unloaded after recording', async () => {
    const store = makeStore({ sessionEvents: {} });
    const record = recordSessionEvent(store.set);

    await record({ sessionId, kind: 'pr_merged' });

    expect(insertSessionEvent).toHaveBeenCalledTimes(1);
    expect(store.read().sessionEvents[sessionId]).toBeUndefined();
  });

  it('keeps the appended events ordered oldest first', async () => {
    const earlier: SessionEvent = {
      id: 'ev-0' as SessionEvent['id'],
      sessionId,
      kind: 'worktree_created',
      payload: null,
      createdAt: '2020-01-01T00:00:00.000Z' as SessionEvent['createdAt'],
    };
    const store = makeStore({ sessionEvents: { [sessionId]: [earlier] } });
    const record = recordSessionEvent(store.set);

    await record({ sessionId, kind: 'branch_created' });

    expect((store.read().sessionEvents[sessionId] ?? []).map((event) => event.kind)).toEqual([
      'worktree_created',
      'branch_created',
    ]);
  });

  it('leaves the loaded list untouched when the write fails', async () => {
    insertSessionEvent.mockRejectedValueOnce(new Error('disk full'));
    const store = makeStore({ sessionEvents: { [sessionId]: [] } });
    const record = recordSessionEvent(store.set);

    await record({ sessionId, kind: 'pr_closed' });

    expect(store.read().sessionEvents[sessionId]).toEqual([]);
  });
});
