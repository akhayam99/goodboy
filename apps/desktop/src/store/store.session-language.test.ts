import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const runTurnSpy = vi.fn();
const agentListSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  deleteWorktreesForSession: vi.fn(),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  listResolvedQuestionTextsForSession: vi.fn(async () => []),
  insertTurnEvent: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAgentsForSessions: vi.fn(async () => new Map()),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  countNotifications: vi.fn(async () => ({ total: 0, unread: 0 })),
  NOTIFICATION_LIST_LIMIT: 200,
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(),
  attachWorkflowToSession: vi.fn(),
  detachWorkflowFromSession: vi.fn(),
  updateWorkflowOrder: vi.fn(),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentList: (sessionId: unknown) => agentListSpy(sessionId),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../shared/lib/repo', () => ({ validateGitRepo: vi.fn() }));

const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const STEP_AGENT_ID = 'agent-step' as AgentId;
const CLUSTER_AGENT_ID = 'agent-cluster' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;

const ITALIAN_GOAL = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';
const ENGLISH_GOAL = 'The language picker belongs in the session settings';

const buildSession = (runGoal: string): Session => ({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'unused session goal',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
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
  createdAt: NOW,
  updatedAt: NOW,
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

const stepAgent: Agent = {
  id: STEP_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'implement picker',
  status: 'pending',
};

const clusterAgent: Agent = {
  id: CLUSTER_AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: STEP_AGENT_ID,
  ordinal: 1,
  name: 'mechanical swaps onto existing primitives',
  status: 'pending',
};

async function* emptyStream(): AsyncIterable<TurnEvent> {}

describe('sendTurn session language guard', () => {
  beforeEach(() => {
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    agentListSpy.mockReset();
    agentListSpy.mockResolvedValue([stepAgent, clusterAgent]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const importStore = async () => (await import('./store')).useAppStore;

  const setup = async (runGoal: string) => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession(runGoal)],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [stepAgent, clusterAgent] },
      selectedAgentId: { [SESSION_ID]: STEP_AGENT_ID },
      phaseTemplates: { [WORKSPACE_ID]: [buildWorkflow()] },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: { anthropic: { state: 'connected', identity: 'test' } } as never,
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: '/tmp', createdAt: NOW, updatedAt: NOW },
      ],
    });
    return useAppStore;
  };

  const systemPromptFor = (): string =>
    String((runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>)?.['systemPrompt'] ?? '');

  it('pins an Italian run to Italian for the step agent', async () => {
    const useAppStore = await setup(ITALIAN_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[session-language]');
    expect(systemPrompt).toContain(ITALIAN_GOAL);
    expect(systemPrompt).toContain('Answer in the language that goal is written in');
  });

  it('pins an English run to English through the same rule', async () => {
    const useAppStore = await setup(ENGLISH_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain(ENGLISH_GOAL);
    expect(systemPrompt).not.toContain(ITALIAN_GOAL);
  });

  it('hands a sub-step the run goal rather than the context it was fanned out with', async () => {
    const useAppStore = await setup(ITALIAN_GOAL);
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
    const useAppStore = await setup(ITALIAN_GOAL);
    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: STEP_AGENT_ID, content: 'go' });

    const systemPrompt = systemPromptFor();
    expect(systemPrompt).toContain('[worktree-scope]');
    expect(systemPrompt).toContain('[session-language]');
  });
});
