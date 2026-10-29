import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { anAgent, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const session = aSession({ workspaceId: workspace.id, goal: '' });
const agent = anAgent({ sessionId: session.id, name: 'Auto' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.invokeAgentList.mockResolvedValue([agent]);
  stubStoryInvoke({ query_bridge_serving: false });
  storySpies.getSessionById.mockResolvedValue(session);
  useAppStore.setState({
    sessions: [session],
    sessionWorktrees: { [session.id]: ['/tmp/harborline'] },
    sessionPhaseRuns: { [session.id]: [agent] },
    selectedAgentId: { [session.id]: agent.id },
    agentKindOverride: { [agent.id]: 'auto' },
    workspaces: [workspace],
    ...connectedAnthropicState(),
  });
});

describe('Auto level instructions at the provider boundary', () => {
  it('includes the After the plan rules on every Auto turn', async () => {
    for (const content of ['Fix the Harborline retry path', 'Continue with the approved plan']) {
      storySpies.runTurn.mockClear();
      await useAppStore.getState().sendTurn({ sessionId: session.id, agentId: agent.id, content });

      expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
      const prompt = storySpies.runTurn.mock.calls[0]?.[0]?.systemPrompt;
      expect(prompt).toContain('Asks you: After the plan');
      expect(prompt).toContain('For a change, delegate to a planner first');
      expect(prompt).toContain(
        'Once the plan is approved, hand work to writers without asking again',
      );
      expect(prompt).toContain('Never end a turn with a yes or no question in prose');
      expect(prompt).toContain('a proposal the app renders as a card');
      expect(prompt).toContain('A force push waits for the user to confirm and keeps a backup');
      expect(prompt).not.toContain('Asks you: Every step');
      expect(prompt).not.toContain('Asks you: Never');
    }
  });
});
