import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  ProviderRunId,
  Task,
  TaskId,
  TurnEvent,
  WorkspaceId,
} from '@kay-am/types';

const runTurnSpy = vi.fn();
const cancelTurnSpy = vi.fn();

vi.mock('../turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: cancelTurnSpy,
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../permissions', () => ({
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

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertTask: vi.fn(),
  insertTaskWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForTask: vi.fn(async () => []),
  listMessagesForTask: vi.fn(async () => []),
  listTasksForWorkspace: vi.fn(async () => []),
  listTelemetryForTask: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  deleteWorktreesForTask: vi.fn(),
  setSetting: vi.fn(),
  summarizeTaskTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateTaskState: vi.fn(),
  upsertContextSlot: vi.fn(),
}));

vi.mock('../providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

vi.mock('../budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: vi.fn(async () => []),
  invokePhaseRunInsert: vi.fn(),
  invokePhaseRunUpdateStatus: vi.fn(),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({
  validateGitRepo: vi.fn(),
}));

const SESSION_ID = 'session-1' as TaskId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

function buildSession(): Task {
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
    const routingMod = await import('../routing');
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
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
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

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hello' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');
  });

  it('appends an error event when the stream ends with no assistant text', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hello' });

    const transcript = useAppStore.getState().transcripts[SESSION_ID] ?? [];
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

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'ciao mondo' });

    const transcript = useAppStore.getState().transcripts[SESSION_ID] ?? [];
    const userEvent = transcript.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('ciao mondo');
  });

  it('does not append a duplicate error event when the stream emits a done event', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => doneOnlyStream(args.runId));

    const useAppStore = await importStore();
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hi' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');

    const transcript = useAppStore.getState().transcripts[SESSION_ID] ?? [];
    const errorEvents = transcript.filter((e) => e.kind === 'error');
    expect(errorEvents).toHaveLength(0);
  });
});
