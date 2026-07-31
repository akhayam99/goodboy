import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

const runTurnSpy = vi.fn();
const invokeSpy = vi.fn();
const invokeAgentListSpy = vi.fn(async () => [] as ReadonlyArray<Agent>);
const writeAttachmentSpy = vi.fn(async () => '.goodboy/attachments/spec.pdf');

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
  writeAttachment: () => writeAttachmentSpy(),
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeSpy,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(async () => undefined),
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
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preference',
    fallbackUsed: false,
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
  invokeAgentList: invokeAgentListSpy,
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
  invokeAgentMarkViewed: vi.fn(async () => undefined),
  invokeAgentSetDone: vi.fn(async () => undefined),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
  worktreeChangedFiles: vi.fn(async () => ({ files: [], numstat: '' })),
}));

vi.mock('../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(),
}));

vi.mock('../features/plans/plans', () => ({
  listPlansForSession: vi.fn(async () => []),
  upsertPlan: vi.fn(),
  setPlanStatus: vi.fn(),
  setPlanBody: vi.fn(),
  deletePlan: vi.fn(),
  addPlanConsumption: vi.fn(),
  listConsumptionsForPlan: vi.fn(async () => []),
}));

const SESSION_ID = 'session-fallback-1' as SessionId;
const AGENT_A = 'agent-fallback-a' as AgentId;
const WORKSPACE_ID = 'workspace-fallback' as WorkspaceId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const buildSession = (): Session => ({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'test turn fallback',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions' as const,
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: NOW,
  updatedAt: NOW,
});

const buildAgent = (): Agent => ({
  id: AGENT_A,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'agent 0',
  status: 'pending',
});

async function* emptyStream() {}

const importStore = async () => {
  const mod = await import('./store');
  return mod.useAppStore;
};

describe('sendTurn, provider failure fallback', () => {
  beforeEach(async () => {
    runTurnSpy.mockReset();
    invokeSpy.mockReset();
    invokeAgentListSpy.mockReset();
    invokeAgentListSpy.mockResolvedValue([]);
    runTurnSpy.mockImplementation(() => emptyStream());
    invokeSpy.mockResolvedValue({
      stdout: JSON.stringify({ result: JSON.stringify({ upserts: [] }) }),
      stderr: '',
      exitCode: 0,
    });
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-sonnet-4-5',
      reason: 'preference',
      fallbackUsed: false,
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.clearAllMocks();
  });

  const setup = (useAppStore: Awaited<ReturnType<typeof importStore>>) => {
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [buildAgent()] },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [] },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
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
  };

  it('retries a usage-limit failure once on a cheaper model of the same provider', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    runTurnSpy.mockImplementationOnce(async function* () {
      throw new Error('rate limit exceeded for this account');
    });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(runTurnSpy).toHaveBeenCalledTimes(2);
    expect(runTurnSpy.mock.calls[0]?.[0]?.model).toBe('claude-sonnet-4-5');
    expect(runTurnSpy.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ provider: 'anthropic', model: 'claude-haiku-4-5' }),
    );
    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const notice = transcript.find(
      (event) => event.kind === 'error' && event.message.includes('retrying on'),
    );
    expect(notice).toBeDefined();
    expect(transcript.filter((event) => event.kind === 'user_text')).toHaveLength(1);
    expect(useAppStore.getState().agentTurnState[AGENT_A]?.kind).not.toBe('error');
  });

  it('reuses the attachments of the first attempt instead of writing them again', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    runTurnSpy.mockImplementationOnce(async function* () {
      throw new Error('rate limit exceeded for this account');
    });

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'read the spec',
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'spec.pdf',
          mimeType: 'application/pdf',
          dataBase64: 'ZmFrZQ==',
        } as never,
      ],
    });

    expect(writeAttachmentSpy).toHaveBeenCalledOnce();
    expect(runTurnSpy).toHaveBeenCalledTimes(2);
    expect(runTurnSpy.mock.calls[1]?.[0]?.prompt).toContain('.goodboy/attachments/spec.pdf');
    const transcript = useAppStore.getState().transcripts[AGENT_A] ?? [];
    expect(transcript.filter((event) => event.kind === 'user_text')).toHaveLength(1);
  });

  it('leaves an unclassified failure in the error state without retrying', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    runTurnSpy.mockImplementation(async function* () {
      throw new Error('connection reset by peer');
    });

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' }),
    ).rejects.toThrow('connection reset by peer');

    expect(runTurnSpy).toHaveBeenCalledOnce();
    expect(useAppStore.getState().agentTurnState[AGENT_A]?.kind).toBe('error');
  });
});
