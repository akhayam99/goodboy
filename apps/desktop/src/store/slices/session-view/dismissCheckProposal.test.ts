// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

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

const SESSION: SessionId = JSON.parse(JSON.stringify('session-1'));
const AGENT: AgentId = JSON.parse(JSON.stringify('agent-1'));

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('dismissCheckProposal', () => {
  it('records the agent once for the session', () => {
    store.getState().dismissCheckProposal({ sessionId: SESSION, agentId: AGENT });
    store.getState().dismissCheckProposal({ sessionId: SESSION, agentId: AGENT });
    expect(store.getState().dismissedCheckProposals[SESSION]).toEqual([AGENT]);
  });
});
