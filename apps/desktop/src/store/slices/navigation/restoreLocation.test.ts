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
import {
  brandId,
  type AgentId,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { createDrawerSlice } from '../drawer';
import { createNavigationSlice } from '.';
import { agentPlace, sessionPlace } from './place';
import { EMPTY_FOCUS } from './types';
import { captureWindowLocation } from './captureWindowLocation';
import { parseLocation } from '../../../features/workspace/windowLayout';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const AGENT = brandId<AgentId>({ value: 'agent-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const restoreTestStore = () =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 })],
    navigation: {},
    appStudio: null,
    activeLens: {},
    selectedAgentId: {},
    focusedWorkflowRunId: {},
    focusedArtifactId: {},
    drawer: null,
    sessionPhaseRuns: { [S1]: [anAgent({ id: AGENT, sessionId: S1 })] },
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

describe('the rest of a reload', () => {
  it('reopens an archived session the window was on, the page reads archived too', async () => {
    const ARCHIVED = brandId<SessionId>({ value: 'session-archived' });
    const store = restoreTestStore();
    store.setState({ archivedSessions: { [WS]: [aSession({ id: ARCHIVED })] } });

    await store.getState().restoreLocation({
      location: {
        workspaceId: WS,
        place: {
          at: 'session',
          sessionId: ARCHIVED,
          view: { lens: null, agentId: null, target: null },
        },
        studio: null,
        focus: EMPTY_FOCUS,
      },
    });

    expect(store.getState().currentSessionId).toBe(ARCHIVED);
  });

  it('keeps the project the Scripts panel was opened for across a reload', async () => {
    const PROJECT = brandId<ProjectId>({ value: 'project-ledger-core' });
    const before = restoreTestStore();
    before.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    before
      .getState()
      .openDrawer({ kind: 'scripts', sessionId: S1, payload: { projectId: PROJECT } });
    const saved = parseLocation({
      value: JSON.parse(JSON.stringify(captureWindowLocation({ state: before.getState() }))),
    });

    const after = restoreTestStore();
    await after.getState().restoreLocation({ location: saved! });

    expect(after.getState().drawer).toMatchObject({
      kind: 'scripts',
      payload: { projectId: PROJECT },
    });
  });

  it('comes back to the Browser page on the tab it showed, after the tab was picked on the page', async () => {
    const before = restoreTestStore();
    before.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    before.getState().switchStudio({ studio: { kind: 'browser', sessionId: S1, tabId: null } });
    before
      .getState()
      .amendStudio({ studio: { kind: 'browser', sessionId: S1, tabId: 'tab-checkout' } });
    const saved = parseLocation({
      value: JSON.parse(JSON.stringify(captureWindowLocation({ state: before.getState() }))),
    });

    const after = restoreTestStore();
    await after.getState().restoreLocation({ location: saved! });

    expect(after.getState().appStudio).toEqual({
      kind: 'browser',
      sessionId: S1,
      tabId: 'tab-checkout',
    });
    before.getState().back();
    expect(before.getState().appStudio).toBeNull();
    expect(before.getState().currentSessionId).toBe(S1);
  });

  it('brings Back to the Runs row the page was left from', () => {
    const store = restoreTestStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    store.getState().amendFocus({ patch: { scroll: { runs: 3 } } });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });

    store.getState().back();

    const stack = store.getState().navigation[WS];
    expect(store.getState().activeLens[S1]).toBe('workflows');
    expect(stack?.entries[stack.index]?.focus.scroll).toEqual({ runs: 3 });
  });
});
