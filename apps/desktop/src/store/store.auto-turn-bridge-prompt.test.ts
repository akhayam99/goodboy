import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  stubStoryInvoke,
  emptyTurnStream,
  resetStorySpies,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  type StoryStore,
} from './storyHarness';

const { gates } = vi.hoisted(() => ({ gates: { isDelegationEnabled: true } }));

vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  AUTO_GATES: gates,
}));
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

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const AUTO_AGENT_ID = 'agent-auto' as AgentId;
const PLAIN_AGENT_ID = 'agent-plain' as AgentId;
const BRIDGE_COMMAND =
  '"/Users/ana/Library/Application Support/Goodboy/Goodboy.app/Contents/MacOS/goodboy" query agent';

const autoAgent: Agent = buildStoryAgent({
  id: AUTO_AGENT_ID,
  sessionId: SESSION_ID,
  name: 'Auto',
});

const plainAgent: Agent = buildStoryAgent({
  id: PLAIN_AGENT_ID,
  sessionId: SESSION_ID,
  name: 'implement picker',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type TurnParams = {
  readonly agentId: AgentId;
  readonly isServing: boolean;
};

const systemPromptOfTurn = async ({ agentId, isServing }: TurnParams): Promise<string> => {
  stubStoryInvoke({
    query_bridge_serving: isServing,
    query_bridge_agent_command: isServing ? BRIDGE_COMMAND : null,
  });
  await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, agentId, content: 'go' });
  return String(
    (storySpies.runTurn.mock.calls[0]?.[0] as Record<string, unknown>)?.['systemPrompt'] ?? '',
  );
};

describe('the system prompt of an Auto turn', () => {
  beforeEach(() => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.invokeAgentList.mockResolvedValue([autoAgent, plainAgent]);
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: '',
          state: { kind: 'idle', lastActivityAt: STORY_NOW },
        }),
      ],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [autoAgent, plainAgent] },
      selectedAgentId: { [SESSION_ID]: AUTO_AGENT_ID },
      agentKindOverride: { [AUTO_AGENT_ID]: 'auto' },
      workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws' })],
      workspaceIntegrations: {},
      ...connectedAnthropicState(),
    });
  });

  it('holds the absolute quoted command and no variable while the bridge serves', async () => {
    const prompt = await systemPromptOfTurn({ agentId: AUTO_AGENT_ID, isServing: true });

    expect(prompt).toContain('You are Auto');
    expect(prompt).toContain(`${BRIDGE_COMMAND} delegate --request-id`);
    expect(prompt).not.toContain('GOODBOY_BIN');
    expect(prompt).not.toContain('$');
  });

  it('is the answer-only prompt while the delegation gate is off, serving or not', async () => {
    gates.isDelegationEnabled = false;
    try {
      const prompt = await systemPromptOfTurn({ agentId: AUTO_AGENT_ID, isServing: true });

      expect(prompt).toContain('not available yet');
      expect(prompt).not.toContain('Application Support');
    } finally {
      gates.isDelegationEnabled = true;
    }
  });

  it('is the answer-only prompt while the bridge does not serve', async () => {
    const prompt = await systemPromptOfTurn({ agentId: AUTO_AGENT_ID, isServing: false });

    expect(prompt).toContain('You are Auto');
    expect(prompt).toContain('not available yet');
    expect(prompt).not.toContain('Application Support');
    expect(prompt).not.toContain('GOODBOY_BIN');
  });

  it('leaves the prompt of another kind unchanged', async () => {
    const prompt = await systemPromptOfTurn({ agentId: PLAIN_AGENT_ID, isServing: true });

    expect(prompt).not.toContain('You are Auto');
    expect(prompt).not.toContain('Application Support');
  });
});
