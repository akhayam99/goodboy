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
import { captureLocation } from '../navigation/captureLocation';
import { BOARD_PLACE, HOME_PLACE, sessionPlace } from '../navigation/place';
import { selectIsHomeShown } from '../../../shared/navigation/selectIsHomeShown';

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
const OTHER_WS = brandId<WorkspaceId>({ value: 'ws-northwind' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 })],
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

describe('Home as a place', () => {
  it('opens on the workspace of the window and reads back as the home place', () => {
    state().navigate({ to: HOME_PLACE });

    expect(state().openHomeWorkspaceId).toBe(WS);
    expect(selectIsHomeShown({ state: state() })).toBe(true);
    expect(captureLocation({ state: state() }).place).toEqual(HOME_PLACE);
  });

  it('leaves for the Board and for a session, each clearing the home mark', () => {
    state().navigate({ to: HOME_PLACE });
    state().navigate({ to: BOARD_PLACE });

    expect(state().openHomeWorkspaceId).toBeNull();
    expect(captureLocation({ state: state() }).place).toEqual(BOARD_PLACE);

    state().navigate({ to: HOME_PLACE });
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });

    expect(selectIsHomeShown({ state: state() })).toBe(false);
    expect(state().openHomeWorkspaceId).toBeNull();
  });

  it('comes back with Back after a session, and has no parent of its own', () => {
    state().navigate({ to: HOME_PLACE });
    state().navigate({ to: sessionPlace({ sessionId: S1 }) });
    state().back();

    expect(captureLocation({ state: state() }).place).toEqual(HOME_PLACE);

    state().up();

    expect(captureLocation({ state: state() }).place).toEqual(HOME_PLACE);
  });

  it('is not shown for another workspace or while a session is open', () => {
    state().navigate({ to: HOME_PLACE });

    expect(selectIsHomeShown({ state: { ...state(), currentWorkspaceId: OTHER_WS } })).toBe(false);
    expect(selectIsHomeShown({ state: { ...state(), currentSessionId: S1 } })).toBe(false);
  });
});
