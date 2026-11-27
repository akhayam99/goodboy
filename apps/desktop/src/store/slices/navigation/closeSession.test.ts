// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { captureLocation } from './captureLocation';
import { currentStack } from './currentStack';
import { BOARD_PLACE, HOME_PLACE, branchPlace, sessionPlace } from './place';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({
        currentSessionId: id,
        openHomeWorkspaceId: id === null ? store.getState().openHomeWorkspaceId : null,
      });
    },
    selectAgent: async () => undefined,
  });
});

const state = () => store.getState();

const placeNow = () => captureLocation({ state: state() }).place;

describe('closing a session', () => {
  it('is Back when the entry before the session is Home, so the history stays clean', () => {
    state().navigate({ to: HOME_PLACE });
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });
    const before = currentStack(state());

    state().closeSession({ sessionId: S1 });

    expect(placeNow()).toEqual(HOME_PLACE);
    expect(currentStack(state()).entries).toHaveLength(before.entries.length);
    expect(currentStack(state()).index).toBe(before.index - 1);
  });

  it('pushes Home when the session was reached from the Board, and Back reopens it', () => {
    state().navigate({ to: BOARD_PLACE });
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });

    state().closeSession({ sessionId: S1 });

    expect(placeNow()).toEqual(HOME_PLACE);

    state().back();

    expect(placeNow()).toEqual(sessionPlace({ sessionId: S1 }));

    state().forward();

    expect(placeNow()).toEqual(HOME_PLACE);
  });

  it('closes a deeper page of the session straight to Home', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });
    state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });

    state().closeSession({ sessionId: S1 });

    expect(placeNow()).toEqual(HOME_PLACE);
  });

  it('names its target: another session id closes nothing', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });

    state().closeSession({ sessionId: S2 });

    expect(placeNow()).toEqual(sessionPlace({ sessionId: S1 }));
  });

  it('keeps every session on the Board: nothing is archived and the list is the same', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });

    state().closeSession({ sessionId: S1 });

    expect(state().sessions.map((session) => session.id)).toEqual([S1, S2]);
    expect(state().sessions.every((session) => session.archivedAt == null)).toBe(true);
  });
});

describe('Up from a session', () => {
  it('goes to Home from a session page with no parent', () => {
    state().navigate({ to: BOARD_PLACE });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });

    state().up();

    expect(placeNow()).toEqual(HOME_PLACE);
  });

  it('keeps going to the parent page first, and only then to Home', () => {
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });
    state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });

    state().up();

    expect(placeNow()).toEqual(sessionPlace({ sessionId: S1 }));

    state().up();

    expect(placeNow()).toEqual(HOME_PLACE);
  });
});
