import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_UNATTENDED_TURNS_PER_AGENT,
  resetWorkflowTurnBreaker,
} from './slices/turn/workflowTurnBreaker';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
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

const buildSession = (): Session =>
  buildStorySession({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: '',
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
        goal: '',
      },
    ],
  });

const buildWorkflow = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'flow',
  description: '',
  goal: '',
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('sendTurn workflow turn breaker', () => {
  const emitNotification = vi.fn(async () => undefined);

  beforeEach(() => {
    resetStorySpies();
    resetWorkflowTurnBreaker();
    emitNotification.mockClear();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.invokeAgentList.mockResolvedValue([stepAgent, clusterAgent] as never);
    storySpies.invokeAgentUpdateStatus.mockResolvedValue(undefined as never);
    useAppStore.setState({
      sessions: [buildSession()],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: 'project-turn' as ProjectId,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
            mountId: 'mount-fixture-1' as MountId,
            sessionId: SESSION_ID,
            lastWorktreePath: null,
            baseBranch: null,
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [stepAgent, clusterAgent] },
      selectedAgentId: { [SESSION_ID]: CLUSTER_AGENT_ID },
      phaseTemplates: { [WORKSPACE_ID]: [buildWorkflow()] },
      sessionLanguageAnchor: {},
      workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws' })],
      emitNotification,
      ...connectedAnthropicState(),
    });
  });

  const sendWorkflowTurns = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) {
      await useAppStore.getState().sendTurn({
        sessionId: SESSION_ID,
        agentId: CLUSTER_AGENT_ID,
        content: 'kickoff',
        origin: 'workflow',
      });
    }
  };

  it('halts the agent on the first workflow turn past the cap without running it', async () => {
    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);

    await sendWorkflowTurns(1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: expect.stringContaining('Autorun halted'),
        sessionId: SESSION_ID,
      }),
    );
  });

  it('resets the cap on an operator turn routed to the selected agent', async () => {
    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, content: 'keep going', origin: 'operator' });
    storySpies.runTurn.mockClear();

    await sendWorkflowTurns(1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(emitNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Autorun halted') }),
    );
  });

  it('keeps the cap when an automated turn without an origin reaches the agent', async () => {
    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: CLUSTER_AGENT_ID, content: 'answers' });
    storySpies.runTurn.mockClear();

    await sendWorkflowTurns(1);

    expect(storySpies.runTurn).not.toHaveBeenCalled();
  });
});
