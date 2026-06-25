import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelGroupId,
  Step,
  StepId,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types'

const agentFeaturesMock = { parallelAgents: false, maxParallelism: 4 }
vi.mock('../shared/lib/features', () => ({
  AGENT_FEATURES: agentFeaturesMock,
}))

const runTurnSpy = vi.fn()
const cancelTurnSpy = vi.fn()
const invokeParallelPhaseRunSpawnSpy = vi.fn()

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: cancelTurnSpy,
  invokeParallelPhaseRunSpawn: (args: unknown) => invokeParallelPhaseRunSpawnSpy(args),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}))

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const listenHandlers: Array<(payload: unknown) => void> = []
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, cb: (e: { payload: unknown }) => void) => {
    listenHandlers.push((payload) => cb({ payload }))
    return () => undefined
  }),
}))

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}))

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
}))

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}))

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}))

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}))

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}))

const phaseRunInsertSpy = vi.fn()
const phaseRunUpdateStatusSpy = vi.fn()
const phaseRunListSpy = vi.fn<(sid: SessionId) => Promise<ReadonlyArray<Agent>>>(async () => [])
const parallelPhaseGroupCreateSpy = vi.fn()
const parallelPhaseGroupUpdateCompletedAtSpy = vi.fn()

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentList: (sid: SessionId) => phaseRunListSpy(sid),
  invokeAgentInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokeAgentUpdateStatus: (id: AgentId, fields: unknown) => phaseRunUpdateStatusSpy(id, fields),
  invokeParallelGroupCreate: (args: unknown) => parallelPhaseGroupCreateSpy(args),
  invokeParallelGroupUpdateCompletedAt: (id: ParallelGroupId, at: IsoDateTime) =>
    parallelPhaseGroupUpdateCompletedAtSpy(id, at),
}))

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}))

vi.mock('../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(),
}))

const SESSION_ID = 'session-1' as SessionId
const WORKSPACE_ID = 'workspace-1' as WorkspaceId
const TEMPLATE_ID = 'template-1' as WorkflowId
const RUN_ID = 'run-1' as WorkflowRunId

function buildSession(): Session {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: TEMPLATE_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate' as const,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

function buildDef(args: {
  id: string
  ordinal?: number
  name?: string
  promptPrefix?: string
  parallelGroup?: number
}): Step {
  return {
    id: args.id as StepId,
    workflowId: TEMPLATE_ID,
    ordinal: args.ordinal ?? 1,
    name: args.name ?? args.id,
    promptPrefix: args.promptPrefix ?? `[${args.id}]`,
    ...(args.parallelGroup !== undefined && { parallelGroup: args.parallelGroup }),
  }
}

function buildTemplate(steps: ReadonlyArray<Step>): Workflow {
  const now = '2026-05-07T00:00:00.000Z' as IsoDateTime
  return {
    id: TEMPLATE_ID,
    workspaceId: WORKSPACE_ID,
    name: 'parallel-template',
    description: '',
    steps,
    createdAt: now,
    updatedAt: now,
  }
}

function emitEnd(runId: ProviderRunId, exitCode: number = 0): void {
  for (const h of listenHandlers) {
    h({ runId, type: 'end', exit_code: exitCode, stderr: exitCode === 0 ? '' : 'failed' })
  }
}

async function importStore() {
  const mod = await import('./store')
  return mod.useAppStore
}

function setupSession(
  useAppStore: Awaited<ReturnType<typeof importStore>>,
  steps: ReadonlyArray<Step>,
) {
  const firstStep = steps[0]
  const defaultAgent: Agent = {
    id: 'agent-1' as AgentId,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...(firstStep ? { stepId: firstStep.id, workflowRunId: RUN_ID } : {}),
  }
  useAppStore.setState({
    sessions: [buildSession()],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
    sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
    selectedAgentId: { [SESSION_ID]: defaultAgent.id },
    agentTurnState: {},
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
  })
}

describe('sendTurn, parallel agents branch', () => {
  beforeEach(() => {
    agentFeaturesMock.parallelAgents = false
    agentFeaturesMock.maxParallelism = 4
    runTurnSpy.mockReset()
    cancelTurnSpy.mockReset()
    invokeParallelPhaseRunSpawnSpy.mockReset()
    phaseRunInsertSpy.mockReset()
    phaseRunUpdateStatusSpy.mockReset()
    phaseRunListSpy.mockReset()
    parallelPhaseGroupCreateSpy.mockReset()
    parallelPhaseGroupUpdateCompletedAtSpy.mockReset()
    listenHandlers.length = 0

    invokeParallelPhaseRunSpawnSpy.mockResolvedValue([])
    const insertedPhaseRuns: Agent[] = []
    phaseRunInsertSpy.mockImplementation(
      async (args: { stepId: string; providerRunId: string; ordinal: number; name: string }) => {
        const row: Agent = {
          id: `phase-run-${args.stepId}` as AgentId,
          sessionId: SESSION_ID,
          stepId: args.stepId as StepId,
          ordinal: args.ordinal,
          name: args.name,
          status: 'running',
          runId: args.providerRunId as ProviderRunId,
        }
        insertedPhaseRuns.push(row)
        return row
      },
    )
    phaseRunListSpy.mockImplementation(async () => insertedPhaseRuns.slice())
    parallelPhaseGroupCreateSpy.mockImplementation(
      async (args: {
        sessionId: string
        ordinal: number
        mergeStrategy: ParallelMergeStrategy
      }) => ({
        id: 'group-test' as ParallelGroupId,
        sessionId: args.sessionId,
        ordinal: args.ordinal,
        mergeStrategy: args.mergeStrategy,
        createdAt: '2026-05-07T00:00:00.000Z' as IsoDateTime,
        completedAt: null,
      }),
    )
    parallelPhaseGroupUpdateCompletedAtSpy.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('flag OFF → uses single-run path (no parallel spawn)', async () => {
    async function* emptyStream() {}
    runTurnSpy.mockImplementation(() => emptyStream())

    const useAppStore = await importStore()
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 1 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 1 }),
    ])
    useAppStore.setState({
      settings: { 'experimental.enable_parallel_agents': 'false' },
    })

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' })

    expect(runTurnSpy).toHaveBeenCalledTimes(1)
    expect(invokeParallelPhaseRunSpawnSpy).not.toHaveBeenCalled()
    expect(parallelPhaseGroupCreateSpy).not.toHaveBeenCalled()
  })

  it('flag ON + parallelGroup with 2 siblings → spawns N runs and awaits merge', async () => {
    agentFeaturesMock.parallelAgents = true
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => args.runs.map((r) => r.runId),
    )

    const useAppStore = await importStore()
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 7 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 7 }),
    ])

    const turnPromise = useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'plan' })

    await new Promise((r) => setTimeout(r, 5))

    expect(invokeParallelPhaseRunSpawnSpy).toHaveBeenCalledTimes(2)
    expect(parallelPhaseGroupCreateSpy).toHaveBeenCalledOnce()

    const allCalls = invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
      [{ runs: ReadonlyArray<{ runId: ProviderRunId }> }]
    >
    for (const [args] of allCalls) {
      const runId = args.runs[0]!.runId
      emitEnd(runId, 0)
    }

    await turnPromise

    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce()
    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(2)
    expect(phaseRunUpdateStatusSpy).toHaveBeenCalledTimes(2)
  })

  it('flag ON but only 1 sibling → falls back to single-run path', async () => {
    agentFeaturesMock.parallelAgents = true
    async function* emptyStream() {}
    runTurnSpy.mockImplementation(() => emptyStream())

    const useAppStore = await importStore()
    setupSession(useAppStore, [buildDef({ id: 'solo', ordinal: 1, parallelGroup: 99 })])

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' })

    expect(invokeParallelPhaseRunSpawnSpy).not.toHaveBeenCalled()
    expect(runTurnSpy).toHaveBeenCalledTimes(1)
  })

  it('one run fails (non-zero exit) → group still completes; group not marked as failed when at least one succeeds', async () => {
    agentFeaturesMock.parallelAgents = true
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => args.runs.map((r) => r.runId),
    )

    const useAppStore = await importStore()
    setupSession(useAppStore, [
      buildDef({ id: 'd-a', ordinal: 1, parallelGroup: 3 }),
      buildDef({ id: 'd-b', ordinal: 2, parallelGroup: 3 }),
    ])

    const turnPromise = useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'mixed' })
    await new Promise((r) => setTimeout(r, 5))

    const calls = invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
      [{ runs: ReadonlyArray<{ runId: ProviderRunId }> }]
    >
    emitEnd(calls[0]![0].runs[0]!.runId, 0)
    emitEnd(calls[1]![0].runs[0]!.runId, 1)

    await turnPromise

    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce()
  })
})
