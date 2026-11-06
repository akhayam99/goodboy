// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { DrawerRequest } from '../drawer/state';
import { agentPlace, branchPlace, sessionPlace } from './place';

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
const AGENT = brandId<AgentId>({ value: 'agent-implementer' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: S1,
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    setCurrentSession: async () => undefined,
    selectAgent: async () => undefined,
  });
  store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
});

const state = () => store.getState();

const TOOLS: ReadonlyArray<readonly [string, DrawerRequest]> = [
  ['Context', { kind: 'context', sessionId: S1, payload: { tab: 'goal', view: 'current' } }],
  ['Explore', { kind: 'explore', sessionId: S1, payload: null }],
  ['Scripts', { kind: 'scripts', sessionId: S1, payload: null }],
  ['Agents', { kind: 'spawned', sessionId: S1, payload: null }],
  ['Ask', { kind: 'ask', sessionId: S1, payload: null }],
];

describe('a tool stays open through a move inside its session', () => {
  it.each(TOOLS)(
    'keeps the %s tool across every page, closes it on another session',
    (_name, tool) => {
      state().openDrawer(tool);

      state().navigate({ to: branchPlace({ sessionId: S1, tab: 'files' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
      expect(state().drawer).toEqual(tool);
      state().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
      expect(state().drawer).toEqual(tool);

      state().navigate({ to: sessionPlace({ sessionId: S2 }) });
      expect(state().drawer).toBeNull();
      state().back();
      expect(state().drawer).toEqual(tool);
    },
  );

  it('lets the Agents tool follow the page instead of the agent it revealed', () => {
    state().openDrawer({ kind: 'spawned', sessionId: S1, payload: { agentId: AGENT } });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toEqual({ kind: 'spawned', sessionId: S1, payload: null });
  });

  it('closes a reader or an item on a move, whatever tool it was opened from', () => {
    state().openDrawer({ kind: 'conversation', sessionId: S1, payload: { threadId: 't1' } });
    state().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    expect(state().drawer).toBeNull();
  });
});
