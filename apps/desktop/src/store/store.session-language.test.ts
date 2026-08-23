import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  resetStorySpies,
  storySpies,
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

const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const STEP_AGENT_ID = 'agent-step' as AgentId;
const CLUSTER_AGENT_ID = 'agent-cluster' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;

const ITALIAN_GOAL = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';
const ENGLISH_GOAL = 'The language picker belongs in the session settings';

const buildSession = (runGoal: string): Session =>
  buildStorySession({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'unused session goal',
    state: { kind: 'idle', lastActivityAt: NOW },
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
        goal: runGoal,
      },
    ],
  });

const buildWorkflow = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'flow',
  description: '',
  goal: 'Consolidate the design system onto packages/ui',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
});

const stepAgent: Agent = buildStoryAgent({
  id: STEP_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  name: 'implement picker',
});

const clusterAgent: Agent = buildStoryAgent({
  id: CLUSTER_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: STEP_AGENT_ID,
  ordinal: 1,
  name: 'mechanical swaps onto existing primitives',
});

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

describe('sendTurn session language guard', () => {
  beforeEach(() => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.invokeAgentList.mockResolvedValue([stepAgent, clusterAgent] as never);
  });

  const setup = (runGoal: string) => {
    useAppStore.setState({
      sessions: [buildSession(runGoal)],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [stepAgent, clusterAgent] },
      selectedAgentId: { [SESSION_ID]: STEP_AGENT_ID },
      phaseTemplates: { [WORKSPACE_ID]: [buildWorkflow()] },
      workspaces: [
        buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws', sessionsRoot: '/tmp' }),
      ],
      ...connectedAnthropicState(),
    });
  };

  const systemPromptFor = (): string =>
    String(
      (storySpies.runTurn.mock.calls[0]?.[0] as Record<string, unknown>)?.['systemPrompt'] ?? '',
    );

  it('pins an Italian run to Italian for the step agent', async () => {
    setup(ITALIAN_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[session-language]');
    expect(systemPrompt).toContain(ITALIAN_GOAL);
    expect(systemPrompt).toContain('Answer in the language that goal is written in');
  });

  it('pins an English run to English through the same rule', async () => {
    setup(ENGLISH_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain(ENGLISH_GOAL);
    expect(systemPrompt).not.toContain(ITALIAN_GOAL);
  });

  it('hands a sub-step the run goal rather than the context it was fanned out with', async () => {
    setup(ITALIAN_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: CLUSTER_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain(ITALIAN_GOAL);
    expect(systemPrompt).toContain(
      'whatever language the plan, the carried context, the step summaries, or your own tooling use',
    );
    expect(systemPrompt).not.toContain('Consolidate the design system onto packages/ui');
  });

  it('keeps the worktree scope guard alongside the language guard', async () => {
    setup(ITALIAN_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[worktree-scope]');
    expect(systemPrompt).toContain('[session-language]');
  });
});
