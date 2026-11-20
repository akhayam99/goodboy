import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_UNATTENDED_TURNS_PER_AGENT,
  resetWorkflowTurnBreaker,
} from './slices/turn/workflowTurnBreaker';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type Session,
  type SessionId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import type { ReportErrorParams } from './slices/notifications/reportError';
import { drainUnexpectedCalls } from '../test/unexpectedCalls';
import type { BudgetRule, ProviderName, SessionBudget, WorkflowRun } from '@goodboy/types';

const RUNAWAY_SENTENCE = 'Ran 4 times in an hour with no limit set.';

const RUN_LIMIT: Pick<WorkflowRun, 'spendLimitUsd' | 'spendLimitMode'> = {
  spendLimitUsd: 10,
  spendLimitMode: 'pause',
};

const SESSION_LIMIT: SessionBudget = {
  sessionId: brandId<SessionId>({ value: 'session-1' }),
  softCapUsd: 20,
  onExceed: 'pause',
  warnRatio: 0.8,
};

type RuleParams = {
  readonly provider: ProviderName;
};

const monthlyRule = ({ provider }: RuleParams): BudgetRule => ({
  id: `rule-${provider}`,
  provider,
  period: 'monthly',
  capUsd: 50,
  alertThresholdPct: 80,
  extraTokensBudget: null,
  createdAt: brandId<IsoDateTime>({ value: '2026-05-01T00:00:00.000Z' }),
});
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const NOW = brandId<IsoDateTime>({ value: '2026-05-07T00:00:00.000Z' });
const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-1' });
const STEP_AGENT_ID = brandId<AgentId>({ value: 'agent-step' });
const CLUSTER_AGENT_ID = brandId<AgentId>({ value: 'agent-cluster' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-1' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'wf-1' });

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
    storySpies.invokeAgentList.mockResolvedValue([stepAgent, clusterAgent]);
    storySpies.invokeAgentUpdateStatus.mockResolvedValue({ ...clusterAgent, status: 'blocked' });
    useAppStore.setState({
      sessions: [buildSession()],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: brandId<ProjectId>({ value: 'project-turn' }),
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
            mountId: brandId<MountId>({ value: 'mount-fixture-1' }),
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

  it('holds the agent in Needs you on the first workflow turn past the cap when no limit is set', async () => {
    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);

    await sendWorkflowTurns(1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      CLUSTER_AGENT_ID,
      expect.objectContaining({ status: 'blocked', stoppedBy: 'breaker' }),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Needs you: mechanical swaps onto existing primitives',
        body: RUNAWAY_SENTENCE,
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
      expect.objectContaining({ body: RUNAWAY_SENTENCE }),
    );
  });

  it('lets the fifth workflow turn run when the run has a limit', async () => {
    const [session] = useAppStore.getState().sessions;
    if (session === undefined) {
      throw new Error('no session');
    }
    useAppStore.setState({
      sessions: [
        {
          ...session,
          workflowRuns: session.workflowRuns.map((run) => ({ ...run, ...RUN_LIMIT })),
        },
      ],
    });

    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT + 1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT + 1);
    expect(storySpies.invokeAgentUpdateStatus).not.toHaveBeenCalledWith(
      CLUSTER_AGENT_ID,
      expect.objectContaining({ status: 'blocked' }),
    );
  });

  it('lets the fifth workflow turn run when the session has a limit that pauses, read fresh after a restart', async () => {
    storySpies.invokeSessionBudgetGet.mockResolvedValue(SESSION_LIMIT);
    useAppStore.setState({ sessionBudgets: {}, budgetRules: [] });

    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT + 1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT + 1);
  });

  it('lets the fifth workflow turn run when every provider the turn can use has a monthly limit', async () => {
    storySpies.invokeBudgetRuleList.mockResolvedValue([monthlyRule({ provider: 'anthropic' })]);

    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT + 1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT + 1);
  });

  it('keeps the breaker when the monthly limit covers another provider only', async () => {
    storySpies.invokeBudgetRuleList.mockResolvedValue([monthlyRule({ provider: 'openai' })]);

    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT + 1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: RUNAWAY_SENTENCE }),
    );
  });

  it('keeps the breaker and says so when the limits cannot be read', async () => {
    const reportError = vi.fn<(params: ReportErrorParams) => Promise<void>>(async () => undefined);
    useAppStore.setState({ reportError });
    storySpies.invokeSessionBudgetGet.mockRejectedValue(new Error('database is locked'));

    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT + 1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't read the spend limits" }),
    );
  });

  it('refuses a workflow turn past a session limit that pauses, with no breaker to catch it', async () => {
    storySpies.invokeSessionBudgetGet.mockResolvedValue(SESSION_LIMIT);
    useAppStore.setState({
      sessionBudgets: { [SESSION_ID]: SESSION_LIMIT },
      budgetAlerts: [
        {
          id: 'alert-1',
          kind: 'session-exceeded',
          sessionId: SESSION_ID,
          currentUsd: 21,
          capUsd: 20,
          createdAt: NOW,
        },
      ],
    });

    const result = await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: CLUSTER_AGENT_ID,
      content: 'continue the cluster',
      origin: 'workflow',
    });

    expect(result).toEqual({ blockedOverBudget: true });
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(drainUnexpectedCalls()).toEqual([
      'db: updateWorkflowRunOrchestrationStop({}, "run-1", {"kind":"budget","message":"Paused at the $20.00 limit for this session."})',
    ]);
    useAppStore.setState({ budgetAlerts: [] });
  });

  it('says so when the agent cannot be held, and still sends nothing', async () => {
    const reportError = vi.fn<(params: ReportErrorParams) => Promise<void>>(async () => undefined);
    useAppStore.setState({ reportError });
    await sendWorkflowTurns(MAX_UNATTENDED_TURNS_PER_AGENT);
    storySpies.invokeAgentUpdateStatus.mockRejectedValueOnce(new Error('database is locked'));
    await sendWorkflowTurns(1);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(MAX_UNATTENDED_TURNS_PER_AGENT);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't hold mechanical swaps onto existing primitives" }),
    );
    expect(emitNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ body: RUNAWAY_SENTENCE }),
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
