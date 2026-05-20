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
} from '@kay-am/types';

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

vi.mock('@kay-am/db', () => ({
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

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

function buildSession(): Session {
  const now = '2026-05-08T00:00:00.000Z' as IsoDateTime;
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic',
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    skipInit: false,
    workflowAborted: false,
    userStatus: 'wip',
    createdAt: now,
    updatedAt: now,
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {
  // CLI exits without emitting any event — no `done`, no `error`, no
  // `assistant_text`. Mirrors a provider that runs to completion but
  // emits no parseable result line.
}

async function* doneOnlyStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'done',
    runId,
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
}

describe('sendTurn — terminal state guarantees', () => {
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

  async function importStore() {
    const mod = await import('./store');
    return mod.useAppStore;
  }

  function setupSession(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    const defaultAgent: Agent = {
      id: 'agent-1' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: 'agent 1',
      status: 'pending',
    };
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
      selectedAgentId: { [SESSION_ID]: defaultAgent.id },
      transcripts: {},
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
        {
          id: WORKSPACE_ID,
          name: 'ws',
          rootPath: '/tmp',
          createdAt: '2026-05-08T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-05-08T00:00:00.000Z' as IsoDateTime,
        },
      ],
    });
  }

  it('transitions session to idle after stream ends without a done event', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');
  });

  it('appends an error event when the stream ends with no assistant text', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((e) => e.kind === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent && 'message' in errorEvent ? errorEvent.message : '').toMatch(
      /provider exited without a response/i,
    );
  });

  it('appends user_text event so the user message is visible immediately', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'ciao mondo' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const userEvent = transcript.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('ciao mondo');
  });

  it('does not append a duplicate error event when the stream emits a done event', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => doneOnlyStream(args.runId));

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvents = transcript.filter((e) => e.kind === 'error');
    expect(errorEvents).toHaveLength(0);
  });
});
