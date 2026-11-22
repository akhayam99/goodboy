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
import { aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { createDrawerSlice } from '../drawer';
import { createNavigationSlice } from '.';
import { canonicalLocation, lensPlace } from './canonicalLocation';
import { captureWindowLocation } from './captureWindowLocation';
import { crumbsOf } from './crumbsOf';
import { parentPlace } from './parentPlace';
import { sessionPlace } from './place';
import { parseLocation } from '../../../features/workspace/windowLayout';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const placeStore = () =>
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

describe('the Activity page of a session', () => {
  it('is a page under the Overview with the crumbs Overview then Activity', () => {
    const state = placeStore().getState();
    const place = lensPlace({ state, sessionId: S1, lens: 'activity' });

    expect(canonicalLocation({ state, request: place }).place).toEqual(place);
    expect(crumbsOf({ state, place }).map((crumb) => crumb.label)).toEqual([
      'Overview',
      'Activity',
    ]);
    expect(parentPlace({ state, place })).toEqual(sessionPlace({ sessionId: S1 }));
  });

  it('reopens on Activity after a reload of the window', async () => {
    const before = placeStore();
    const state = before.getState();
    state.navigate({ to: lensPlace({ state, sessionId: S1, lens: 'activity' }) });
    const saved = parseLocation({
      value: JSON.parse(JSON.stringify(captureWindowLocation({ state: before.getState() }))),
    });
    if (saved === null) {
      throw new Error('the window location did not parse');
    }

    const after = placeStore();
    await after.getState().restoreLocation({ location: saved });

    expect(after.getState().currentSessionId).toBe(S1);
    expect(after.getState().activeLens[S1]).toBe('activity');
  });
});
