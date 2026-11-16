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
import { agentPlace, sessionPlace } from './place';
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

const storedWork: Location = {
  workspaceId: WS,
  place: { at: 'board' },
  studio: { kind: 'work', filter: 'needsYou' },
  focus: EMPTY_FOCUS,
};

describe('the Work destination', () => {
  it('opens a Lead inside its session and Back returns to the list with its filter', () => {
    const store = windowStore();
    store.getState().switchStudio({ studio: { kind: 'work', filter: 'needsYou' } });

    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: LEAD }) });

    expect(store.getState().appStudio).toBeNull();
    expect(captureWindowLocation({ state: store.getState() }).place).toEqual(
      sessionPlace({ sessionId: S1, lens: 'workflows', agentId: LEAD }),
    );

    store.getState().back();

    expect(store.getState().appStudio).toEqual({ kind: 'work', filter: 'needsYou' });
  });

  it('keeps the filter a window picked across a reload', async () => {
    const before = windowStore();
    before.getState().switchStudio({ studio: { kind: 'work' } });
    before.getState().amendStudio({ studio: { kind: 'work', filter: 'working' } });
    const saved: Location = JSON.parse(
      JSON.stringify(captureWindowLocation({ state: before.getState() })),
    );

    const after = windowStore();
    await after.getState().restoreLocation({ location: saved });

    expect(after.getState().appStudio).toEqual({ kind: 'work', filter: 'working' });
  });

  it.each([[undefined], ['true'], ['false']] as const)(
    'restores a stored Work place, old Work switch row %s',
    async (oldSwitch) => {
      const store = windowStore({ oldSwitch });

      await store.getState().restoreLocation({ location: storedWork });

      expect(store.getState().appStudio).toEqual({ kind: 'work', filter: 'needsYou' });
    },
  );
});
