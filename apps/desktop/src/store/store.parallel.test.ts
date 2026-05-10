import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelGroupId,
  Step,
  StepId,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  ProviderRunId,
  Task,
  TaskId,
  WorkspaceId,
} from '@kay-am/types';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before importing the store.
// ---------------------------------------------------------------------------

const runTurnSpy = vi.fn();
const cancelTurnSpy = vi.fn();
const invokeParallelPhaseRunSpawnSpy = vi.fn();

vi.mock('../turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: cancelTurnSpy,
  invokeParallelPhaseRunSpawn: (args: unknown) => invokeParallelPhaseRunSpawnSpy(args),
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

// Listener mock — captures the registered handler so tests can drive 'end' events.
const listenHandlers: Array<(payload: unknown) => void> = [];
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, cb: (e: { payload: unknown }) => void) => {
    listenHandlers.push((payload) => cb({ payload }));
    return () => undefined; // unlisten
  }),
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
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
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

const phaseRunInsertSpy = vi.fn();
const phaseRunUpdateStatusSpy = vi.fn();
const phaseRunListSpy = vi.fn<(sid: TaskId) => Promise<ReadonlyArray<Session>>>(async () => []);
const parallelPhaseGroupCreateSpy = vi.fn();
const parallelPhaseGroupUpdateCompletedAtSpy = vi.fn();

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: (sid: TaskId) => phaseRunListSpy(sid),
  invokePhaseRunInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokePhaseRunUpdateStatus: (id: SessionId, fields: unknown) =>
    phaseRunUpdateStatusSpy(id, fields),
  invokeParallelPhaseGroupCreate: (args: unknown) => parallelPhaseGroupCreateSpy(args),
  invokeParallelPhaseGroupUpdateCompletedAt: (id: ParallelGroupId, at: IsoDateTime) =>
    parallelPhaseGroupUpdateCompletedAtSpy(id, at),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({
  validateGitRepo: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-1' as TaskId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const TEMPLATE_ID = 'template-1' as WorkflowId;

function buildSession(): Task {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    workflowId: TEMPLATE_ID,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDef(args: {
  id: string;
  ordinal?: number;
  name?: string;
  promptPrefix?: string;
  parallelGroup?: number;
}): Step {
  return {
    id: args.id as StepId,
    workflowId: TEMPLATE_ID,
    ordinal: args.ordinal ?? 1,
    name: args.name ?? args.id,
    promptPrefix: args.promptPrefix ?? `[${args.id}]`,
    ...(args.parallelGroup !== undefined && { parallelGroup: args.parallelGroup }),
  };
}

function buildTemplate(steps: ReadonlyArray<Step>): Workflow {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
  return {
    id: TEMPLATE_ID,
    workspaceId: WORKSPACE_ID,
    name: 'parallel-template',
    description: '',
    steps,
    createdAt: now,
    updatedAt: now,
  };
}

function emitEnd(runId: ProviderRunId, exitCode: number = 0): void {
  for (const h of listenHandlers) {
    h({ runId, type: 'end', exit_code: exitCode, stderr: exitCode === 0 ? '' : 'failed' });
  }
}

async function importStore() {
  const mod = await import('./store');
  return mod.useAppStore;
}

function setupSession(
  useAppStore: Awaited<ReturnType<typeof importStore>>,
  steps: ReadonlyArray<Step>,
) {
  const defaultAgent: Session = {
    id: 'agent-1' as SessionId,
    taskId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
  };
  useAppStore.setState({
    sessions: [buildSession()],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
    sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
    selectedAgentId: { [SESSION_ID]: defaultAgent.id },
    settings: {
      'experimental.enable_parallel_agents': 'true',
      'experimental.max_parallelism': '4',
    },
    phaseTemplates: { [WORKSPACE_ID]: [buildTemplate(steps)] },
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
        createdAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendTurn — parallel agents branch', () => {
  beforeEach(() => {
    runTurnSpy.mockReset();
    cancelTurnSpy.mockReset();
    invokeParallelPhaseRunSpawnSpy.mockReset();
    phaseRunInsertSpy.mockReset();
    phaseRunUpdateStatusSpy.mockReset();
    phaseRunListSpy.mockReset();
    parallelPhaseGroupCreateSpy.mockReset();
    parallelPhaseGroupUpdateCompletedAtSpy.mockReset();
    listenHandlers.length = 0;

    invokeParallelPhaseRunSpawnSpy.mockResolvedValue([]);
    const insertedPhaseRuns: Session[] = [];
    phaseRunInsertSpy.mockImplementation(
      async (args: { stepId: string; providerRunId: string; ordinal: number; name: string }) => {
        const row: Session = {
          id: `phase-run-${args.stepId}` as SessionId,
          taskId: SESSION_ID,
          stepId: args.stepId as StepId,
          ordinal: args.ordinal,
          name: args.name,
          status: 'running',
          runId: args.providerRunId as ProviderRunId,
        };
        insertedPhaseRuns.push(row);
        return row;
      },
    );
    phaseRunListSpy.mockImplementation(async () => insertedPhaseRuns.slice());
    parallelPhaseGroupCreateSpy.mockImplementation(
      async (args: { taskId: string; ordinal: number; mergeStrategy: ParallelMergeStrategy }) => ({
        id: 'group-test' as ParallelGroupId,
        taskId: args.taskId,
        ordinal: args.ordinal,
        mergeStrategy: args.mergeStrategy,
        createdAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        completedAt: null,
      }),
    );
    parallelPhaseGroupUpdateCompletedAtSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flag OFF → uses single-run path (no parallel spawn)', async () => {
    async function* emptyStream() {}
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 1 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 1 }),
    ]);
    useAppStore.setState({
      settings: { 'experimental.enable_parallel_agents': 'false' },
    });

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'hi' });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(invokeParallelPhaseRunSpawnSpy).not.toHaveBeenCalled();
    expect(parallelPhaseGroupCreateSpy).not.toHaveBeenCalled();
  });

  it('flag ON + parallelGroup with 2 siblings → spawns N runs and awaits merge', async () => {
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => args.runs.map((r) => r.runId),
    );

    const useAppStore = await importStore();
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 7 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 7 }),
    ]);

    const turnPromise = useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'plan' });

    // Wait for spawn registration so listeners are wired before we emit 'end'.
    await new Promise((r) => setTimeout(r, 5));

    expect(invokeParallelPhaseRunSpawnSpy).toHaveBeenCalledTimes(2);
    expect(parallelPhaseGroupCreateSpy).toHaveBeenCalledOnce();

    // Pull runIds from the spawn calls and emit 'end' for each.
    const allCalls = invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
      [{ runs: ReadonlyArray<{ runId: ProviderRunId }> }]
    >;
    for (const [args] of allCalls) {
      const runId = args.runs[0]!.runId;
      emitEnd(runId, 0);
    }

    await turnPromise;

    // Merge completion was persisted.
    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce();
    // Both phase runs were inserted then updated.
    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(2);
    expect(phaseRunUpdateStatusSpy).toHaveBeenCalledTimes(2);
  });

  it('flag ON but only 1 sibling → falls back to single-run path', async () => {
    async function* emptyStream() {}
    runTurnSpy.mockImplementation(() => emptyStream());

    const useAppStore = await importStore();
    setupSession(useAppStore, [buildDef({ id: 'solo', ordinal: 1, parallelGroup: 99 })]);

    await useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'go' });

    expect(invokeParallelPhaseRunSpawnSpy).not.toHaveBeenCalled();
    expect(runTurnSpy).toHaveBeenCalledTimes(1);
  });

  it('one run fails (non-zero exit) → group still completes; group not marked as failed when at least one succeeds', async () => {
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => args.runs.map((r) => r.runId),
    );

    const useAppStore = await importStore();
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 3 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 3 }),
    ]);

    const turnPromise = useAppStore.getState().sendTurn({ taskId: SESSION_ID, content: 'mixed' });
    await new Promise((r) => setTimeout(r, 5));

    const calls = invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
      [{ runs: ReadonlyArray<{ runId: ProviderRunId }> }]
    >;
    emitEnd(calls[0]![0].runs[0]!.runId, 0);
    emitEnd(calls[1]![0].runs[0]!.runId, 1);

    await turnPromise;

    // Mixed result: at least one completed → group completedAt is set.
    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce();
  });
});
