import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';

const runTurnSpy = vi.fn();
const cancelTurnSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: cancelTurnSpy,
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
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
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
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

vi.mock('../features/phases/phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
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

const SESSION_ID = 'session-rt-1' as SessionId;
const AGENT_A = 'agent-a' as AgentId;
const AGENT_B = 'agent-b' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-05-18T00:00:00.000Z' as IsoDateTime;

function buildSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test agent routing',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    skipInit: false,
    userStatus: 'wip',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildAgent(id: AgentId, ordinal: number): Agent {
  return {
    id,
    sessionId: SESSION_ID,
    ordinal,
    name: `agent ${ordinal}`,
    status: 'pending',
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {}

async function importStore() {
  const mod = await import('./store');
  return mod.useAppStore;
}

describe('sendTurn — agent routing', () => {
  beforeEach(async () => {
    runTurnSpy.mockReset();
    cancelTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preference',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupTwoAgents(
    useAppStore: Awaited<ReturnType<typeof importStore>>,
    selectedAgent: AgentId,
  ) {
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [buildAgent(AGENT_A, 0), buildAgent(AGENT_B, 1)] },
      selectedAgentId: { [SESSION_ID]: selectedAgent },
      transcripts: { [AGENT_A]: [], [AGENT_B]: [] },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        cursor: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: '/tmp', createdAt: NOW, updatedAt: NOW },
      ],
    });
  }

  it('routes user_text to the explicit agentId, not selectedAgentId', async () => {
    const useAppStore = await importStore();
    setupTwoAgents(useAppStore, AGENT_A);

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_B, content: 'fix the bug' });

    const transcriptB = useAppStore.getState().transcripts[AGENT_B] ?? [];
    const userEvent = transcriptB.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('fix the bug');

    const transcriptA = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const userEventA = transcriptA.find((e) => e.kind === 'user_text');
    expect(userEventA).toBeUndefined();
  });

  it('falls back to selectedAgentId when agentId is omitted', async () => {
    const useAppStore = await importStore();
    setupTwoAgents(useAppStore, AGENT_A);

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, content: 'hello from fallback' });

    const transcriptA = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const userEvent = transcriptA.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('hello from fallback');

    const transcriptB = useAppStore.getState().transcripts[AGENT_B] ?? [];
    expect(transcriptB.find((e) => e.kind === 'user_text')).toBeUndefined();
  });

  it('sends the AI request to the explicit agent even if selectedAgentId changes mid-flight', async () => {
    const useAppStore = await importStore();
    setupTwoAgents(useAppStore, AGENT_A);

    runTurnSpy.mockImplementation(async function* (args: { runId: ProviderRunId }) {
      yield {
        kind: 'done' as const,
        runId: args.runId,
        at: NOW,
      };
    });

    useAppStore.setState({ selectedAgentId: { [SESSION_ID]: AGENT_B } });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'pinned to A' });

    const transcriptA = useAppStore.getState().transcripts[AGENT_A] ?? [];
    const userEvent = transcriptA.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('pinned to A');

    expect(runTurnSpy).toHaveBeenCalledOnce();
  });
});
