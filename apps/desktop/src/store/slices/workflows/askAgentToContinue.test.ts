// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, TurnProviderOverride } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import type { SendTurnResult } from '../turn/types';
import { claimWorkflowTurn, resetWorkflowTurnBreaker } from '../turn/workflowTurnBreaker';
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
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock({}));

const session = aSession();
const blockedAgent: Agent = anAgent({ sessionId: session.id, status: 'blocked' });

let useAppStore: StoryStore;
const sendTurn = vi.fn(async (): Promise<SendTurnResult> => ({ blockedOverBudget: false }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorkflowTurnBreaker();
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [blockedAgent] },
    agentTurnState: {},
    sendTurn,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('askAgentToContinue', () => {
  it('sends the route the composer picked', async () => {
    const override: TurnProviderOverride = { providerId: 'codex', model: 'gpt-6' };

    await useAppStore
      .getState()
      .askAgentToContinue({ sessionId: session.id, agentId: blockedAgent.id, override });

    expect(sendTurn).toHaveBeenCalledWith(expect.objectContaining({ override }));
  });

  it('treats the press as attended, so a tripped unattended breaker lets it through', async () => {
    for (let count = 0; count < 4; count += 1) {
      claimWorkflowTurn({ agentId: blockedAgent.id, nowMs: Date.now() });
    }

    await useAppStore
      .getState()
      .askAgentToContinue({ sessionId: session.id, agentId: blockedAgent.id });

    expect(claimWorkflowTurn({ agentId: blockedAgent.id, nowMs: Date.now() })).toBe('granted');
  });
});
