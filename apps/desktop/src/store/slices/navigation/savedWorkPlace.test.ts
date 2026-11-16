// @vitest-environment happy-dom
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

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { createDrawerSlice } from '../drawer';
import { createNavigationSlice } from '.';
import { captureWindowLocation } from './captureWindowLocation';
import { sessionPlace } from './place';
import { EMPTY_FOCUS, type Location } from './types';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const EMPTY_SETTINGS: Readonly<Record<string, string>> = {};

type WindowParams = {
  readonly oldSwitch?: 'true' | 'false';
};

const windowStore = ({ oldSwitch }: WindowParams = {}) =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 })],
    navigation: {},
    appStudio: null,
    drawer: null,
    settings: oldSwitch === undefined ? EMPTY_SETTINGS : { 'work.enabled': oldSwitch },
    sessionPhaseRuns: { [S1]: [anAgent({ id: LEAD, sessionId: S1, name: 'planner' })] },
    setCurrentSession: async (id: SessionId | null) => {
      set((state) => ({
        currentSessionId: id,
        activeLens: id === null ? state.activeLens : { ...state.activeLens, [id]: null },
      }));
    },
    selectAgent: async (sessionId: SessionId, agentId: AgentId) => {
      set((state) => ({ selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId } }));
    },
    ...createNavigationSlice({ set, get }),
    ...createDrawerSlice({ set, get }),
  }));

const storedWork: Location = JSON.parse(
  JSON.stringify({
    workspaceId: WS,
    place: sessionPlace({ sessionId: S1 }),
    studio: { kind: 'work', filter: 'needsYou' },
    focus: { ...EMPTY_FOCUS, drawer: { kind: 'scripts', sessionId: S1, payload: null } },
  }),
);

const storedSession: Location = {
  workspaceId: WS,
  place: sessionPlace({ sessionId: S1, lens: 'workflows', agentId: LEAD }),
  studio: null,
  focus: EMPTY_FOCUS,
};

describe('a saved place on the retired Work page', () => {
  it.each([[undefined], ['true'], ['false']] as const)(
    'opens the Board, old Work switch row %s',
    async (oldSwitch) => {
      const store = windowStore({ oldSwitch });

      await store.getState().restoreLocation({ location: storedWork });

      expect(store.getState().appStudio).toBeNull();
      expect(store.getState().drawer).toBeNull();
      expect(store.getState().currentSessionId).toBeNull();
      expect(captureWindowLocation({ state: store.getState() }).place).toEqual({ at: 'board' });
    },
  );

  it('folds each window on its own, so a second window keeps its session', async () => {
    const first = windowStore({ oldSwitch: 'true' });
    const second = windowStore({ oldSwitch: 'true' });

    await Promise.all([
      first.getState().restoreLocation({ location: storedWork }),
      second.getState().restoreLocation({ location: storedSession }),
    ]);

    expect(captureWindowLocation({ state: first.getState() }).place).toEqual({ at: 'board' });
    expect(second.getState().currentSessionId).toBe(S1);
    expect(captureWindowLocation({ state: second.getState() }).place).toEqual(storedSession.place);
  });
});
