// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { agentPlace, branchPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import { isFaceShown } from '../SessionDesk/isFaceShown';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const LEAD_ID = brandId<AgentId>({ value: 'agent-lead' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
    selectAgent: async () => undefined,
  });
  store.getState().setSessionFace({ sessionId: SESSION_ID, face: 'desk' });
});

const isDeskColumnShown = () => isFaceShown({ state: store.getState(), sessionId: SESSION_ID });

describe('the desk column and the left rails', () => {
  it('draws the desk column on the session itself', () => {
    store.getState().navigate({ to: sessionPlace({ sessionId: SESSION_ID }) });

    expect(isDeskColumnShown()).toBe(true);
  });

  it('yields the left place to the Agents rail of the Lead', () => {
    store.getState().navigate({ to: agentPlace({ sessionId: SESSION_ID, agentId: LEAD_ID }) });

    expect(isDeskColumnShown()).toBe(false);
  });

  it('yields the left place to the file list of Changes', () => {
    store.getState().navigate({ to: branchPlace({ sessionId: SESSION_ID, tab: 'files' }) });

    expect(isDeskColumnShown()).toBe(false);
  });
});
