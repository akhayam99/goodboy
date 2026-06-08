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
  invokeAgentList: vi.fn(async () => []),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
  invokeAgentMarkViewed: vi.fn(async () => undefined),
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
    workflowRuns: [],
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

describe('sendTurn, agent routing', () => {
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

describe('sendTurn, resolver config (provider pin + effort)', () => {
  beforeEach(async () => {
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preference',
    });
    const workflowsMod = await import('../features/workflows/workflows');
    (workflowsMod.invokeAgentList as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setup(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [buildAgent(AGENT_A, 0)] },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      pendingResolverKickoff: {},
      transcripts: { [AGENT_A]: [] },
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
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        { id: WORKSPACE_ID, name: 'ws', rootPath: '/tmp', createdAt: NOW, updatedAt: NOW },
      ],
    });
  }

  it('passes --effort (mapped) to runTurn when an effort override is set on anthropic', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    useAppStore.setState({ agentEffortOverride: { [AGENT_A]: 'extra-high' } });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(runTurnSpy).toHaveBeenCalledOnce();
    expect(runTurnSpy.mock.calls[0]?.[0]?.effort).toBe('xhigh');
  });

  it('omits effort from runTurn when no override is set (model default preserved)', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(runTurnSpy.mock.calls[0]?.[0]?.effort).toBeUndefined();
  });

  it('passes clamped effort to runTurn when the resolved provider is codex', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'codex',
      selectedModel: 'gpt-5.5',
      reason: 'override',
    });
    useAppStore.setState({ agentEffortOverride: { [AGENT_A]: 'max' } });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(runTurnSpy.mock.calls[0]?.[0]?.effort).toBe('high');
  });

  it('omits effort when the resolved provider has no effort axis (gemini)', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'gemini',
      selectedModel: 'gemini-2.5-pro',
      reason: 'override',
    });
    useAppStore.setState({ agentEffortOverride: { [AGENT_A]: 'high' } });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(runTurnSpy.mock.calls[0]?.[0]?.effort).toBeUndefined();
  });

  it('pins the provider override into routing even when the session forbids turn overrides', async () => {
    const useAppStore = await importStore();
    setup(useAppStore);
    useAppStore.setState({
      agentProviderOverride: { [AGENT_A]: 'codex' },
      agentModelOverride: { [AGENT_A]: 'gpt-5-codex' },
    });
    const routingMod = await import('../features/providers/routing');
    const spy = routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>;

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(spy).toHaveBeenCalled();
    const [preference, override] = spy.mock.calls[0]!;
    expect(preference.allowTurnOverride).toBe(true);
    expect(override).toEqual({ providerId: 'codex', model: 'gpt-5-codex' });
  });

  it('a resolver that emits a resolution marker records committed and advances the queue', async () => {
    const useAppStore = await importStore();
    const workflowsMod = await import('../features/workflows/workflows');
    (workflowsMod.invokeAgentList as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...buildAgent(AGENT_A, 0), status: 'completed' },
      buildAgent(AGENT_B, 1),
    ]);
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [buildAgent(AGENT_A, 0), buildAgent(AGENT_B, 1)] },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [], [AGENT_B]: [] },
      agentKindOverride: { [AGENT_A]: 'resolver', [AGENT_B]: 'resolver' },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      resolverState: {},
      pendingResolverKickoff: { [AGENT_B]: 'kick B' },
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
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementationOnce(async function* (args: { runId: ProviderRunId }) {
      yield {
        kind: 'assistant_text' as const,
        runId: args.runId,
        delta: '<<comment-resolved threadId="PRRT_1" commit="abc1234">>',
        at: NOW,
      };
      yield { kind: 'done' as const, runId: args.runId, at: NOW };
    });
    runTurnSpy.mockImplementation(() => emptyStream());

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(useAppStore.getState().resolverState[AGENT_A]).toBe('committed');
    await vi.waitFor(() => expect(runTurnSpy).toHaveBeenCalledTimes(2));
    expect(useAppStore.getState().pendingResolverKickoff[AGENT_B]).toBeUndefined();
  });

  it('a resolver that ends without a marker records awaiting and blocks the queue', async () => {
    const useAppStore = await importStore();
    const workflowsMod = await import('../features/workflows/workflows');
    (workflowsMod.invokeAgentList as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...buildAgent(AGENT_A, 0), status: 'completed' },
      buildAgent(AGENT_B, 1),
    ]);
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [buildAgent(AGENT_A, 0), buildAgent(AGENT_B, 1)] },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [], [AGENT_B]: [] },
      agentKindOverride: { [AGENT_A]: 'resolver', [AGENT_B]: 'resolver' },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      resolverState: {},
      pendingResolverKickoff: { [AGENT_B]: 'kick B' },
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
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(async function* (args: { runId: ProviderRunId }) {
      yield {
        kind: 'assistant_text' as const,
        runId: args.runId,
        delta: 'this is non-trivial. can I commit?',
        at: NOW,
      };
      yield { kind: 'done' as const, runId: args.runId, at: NOW };
    });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_A, content: 'go' });

    expect(useAppStore.getState().resolverState[AGENT_A]).toBe('awaiting');
    expect(runTurnSpy).toHaveBeenCalledOnce();
    expect(useAppStore.getState().pendingResolverKickoff[AGENT_B]).toBe('kick B');
  });

  it('activateNextResolver runs only the head of the queue and dequeues it', async () => {
    const useAppStore = await importStore();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: {
        [SESSION_ID]: [buildAgent(AGENT_A, 0), buildAgent(AGENT_B, 1)],
      },
      selectedAgentId: {},
      transcripts: { [AGENT_A]: [], [AGENT_B]: [] },
      agentKindOverride: { [AGENT_A]: 'resolver', [AGENT_B]: 'resolver' },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      pendingResolverKickoff: { [AGENT_A]: 'kick A', [AGENT_B]: 'kick B' },
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

    await useAppStore.getState().activateNextResolver(SESSION_ID);

    expect(useAppStore.getState().pendingResolverKickoff[AGENT_A]).toBeUndefined();
    expect(useAppStore.getState().pendingResolverKickoff[AGENT_B]).toBe('kick B');
    await vi.waitFor(() => expect(runTurnSpy).toHaveBeenCalledOnce());
    expect(runTurnSpy.mock.calls[0]?.[0]?.prompt).toContain('kick A');
  });
});
