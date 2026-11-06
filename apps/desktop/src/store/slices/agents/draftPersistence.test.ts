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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const TEXT = 'Also cover the 402 path in payments-api, then run the replay again.';
const GOAL = 'Stop retried webhooks posting a second credit in ledger-core';
const session = aSession({ goal: 'Replay one webhook event' });
const tester = anAgent({ sessionId: session.id, name: 'Tester' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [tester] },
  });
});

afterEach(() => {
  localStorage.clear();
});

const reload = () => useAppStore.setState({ agentDraft: {}, sessionDrafts: {} });

describe('the composer draft', () => {
  it('comes back after a reload', () => {
    useAppStore.getState().setAgentDraft(tester.id, TEXT);
    reload();

    useAppStore.getState().hydrateAgentDraft({ agentId: tester.id });

    expect(useAppStore.getState().agentDraft[tester.id]).toBe(TEXT);
  });

  it('stays gone once it was cleared by a send', () => {
    useAppStore.getState().setAgentDraft(tester.id, TEXT);
    useAppStore.getState().clearAgentDraft(tester.id);
    reload();

    useAppStore.getState().hydrateAgentDraft({ agentId: tester.id });

    expect(useAppStore.getState().agentDraft[tester.id]).toBeUndefined();
  });

  it('never overwrites what is in the box already', () => {
    useAppStore.getState().setAgentDraft(tester.id, TEXT);
    useAppStore.setState({ agentDraft: { [tester.id]: 'typed after the load' } });

    useAppStore.getState().hydrateAgentDraft({ agentId: tester.id });

    expect(useAppStore.getState().agentDraft[tester.id]).toBe('typed after the load');
  });

  it('survives an archive and comes back with Undo', () => {
    useAppStore.getState().setAgentDraft(tester.id, TEXT);

    useAppStore.getState().evictSession({ sessionId: session.id, mode: 'archive' });

    expect(useAppStore.getState().agentDraft[tester.id]).toBe(TEXT);
  });

  it('is swept with a deleted session, in memory and on disk', () => {
    useAppStore.getState().setAgentDraft(tester.id, TEXT);

    useAppStore.getState().evictSession({ sessionId: session.id, mode: 'delete' });
    useAppStore.getState().hydrateAgentDraft({ agentId: tester.id });

    expect(useAppStore.getState().agentDraft[tester.id]).toBeUndefined();
  });
});

describe('the New session draft', () => {
  it('keeps its typed goal across a reload', () => {
    useAppStore
      .getState()
      .patchSessionDraft({ workspaceId: session.workspaceId, patch: { autoGoal: GOAL } });
    reload();

    useAppStore.getState().hydrateSessionDraft({ workspaceId: session.workspaceId });

    expect(useAppStore.getState().sessionDrafts[session.workspaceId]?.autoGoal).toBe(GOAL);
  });

  it('forgets the goal once the draft is discarded', () => {
    useAppStore
      .getState()
      .patchSessionDraft({ workspaceId: session.workspaceId, patch: { autoGoal: GOAL } });
    useAppStore.getState().discardSessionDraft({ workspaceId: session.workspaceId });
    reload();

    useAppStore.getState().hydrateSessionDraft({ workspaceId: session.workspaceId });

    expect(useAppStore.getState().sessionDrafts[session.workspaceId]).toBeUndefined();
  });
});
