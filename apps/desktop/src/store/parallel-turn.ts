import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  buildStepPrompt,
  detectConflicts,
  fanOut,
  awaitMerge,
  cancelGroup,
  resolveConflicts,
  ManualResolutionRequiredError,
  type FileConflict,
  type MergeResult,
  type RunFileTouches,
  type SchedulerDeps,
  type SchedulerHandle,
} from '@goodboy/core'
import {
  parseStreamJsonLine,
  parseCursorStreamLine,
  parseCodexJsonLine,
  parseGeminiJsonLine,
} from '@goodboy/core'
import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelGroupId,
  ParallelAgent,
  ParallelAgentId,
  Step,
  AgentId,
  AgentStatus,
  Workflow,
  ProviderId,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  Workspace,
} from '@goodboy/types'
import {
  invokeParallelGroupCreate,
  invokeParallelGroupUpdateCompletedAt,
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../features/workflows/workflows'
import { invokeParallelPhaseRunSpawn, cancelTurn } from '../features/chat/turn'
import { inferAgentKindFromName } from '../features/session/agent-kind'

export type ParallelBranchInputs = {
  readonly session: Session
  readonly orchestratingAgentId: AgentId
  readonly workspace: Workspace
  readonly currentDef: Step
  readonly groupDefs: ReadonlyArray<Step>
  readonly workingDir: string
  readonly resolvedPromptBase: string
  readonly carryForwardContext: string
  readonly mergeStrategy: ParallelMergeStrategy
  readonly maxParallelism: number
}

export type ParallelBranchEffects = {
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void
  refreshPhaseRuns: (sessionId: SessionId) => Promise<void>
  setMergeConflicts: (sessionId: SessionId, conflicts: ReadonlyArray<FileConflict>) => void
}

export type ParallelBranchResult = {
  readonly groupId: ParallelGroupId
  readonly merge: MergeResult
  readonly runIds: ReadonlyArray<ProviderRunId>
  readonly anyFailed: boolean
  readonly allFailed: boolean
}

export type ParallelDetection = {
  readonly currentDef: Step
  readonly groupDefs: ReadonlyArray<Step>
}

export const detectParallelGroup = (
  template: Workflow,
  currentDef: Step,
): ParallelDetection | null => {
  if (currentDef.parallelGroup === undefined) {
    return null
  }
  const siblings = template.steps
    .filter((d) => d.parallelGroup === currentDef.parallelGroup)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
  if (siblings.length < 2) {
    return null
  }
  return { currentDef, groupDefs: siblings }
}

type RawTurnEnvelope = {
  readonly runId: string
  readonly type: 'line' | 'end' | 'error'
  readonly line?: string
  readonly exit_code?: number | null
  readonly stderr?: string
  readonly message?: string
}

type RunListenerState = {
  readonly onEvent: (e: TurnEvent) => void
  readonly onSettle: (status: AgentStatus, error?: string) => void
  collectedFiles: Set<string>
}

type MultiplexedListener = {
  unlisten: () => Promise<void>
  registerRun: (runId: ProviderRunId, state: RunListenerState) => void
  filesTouchedByRun: (runId: ProviderRunId) => ReadonlyArray<string>
}

function parseProviderLine(
  provider: ProviderId,
  line: string,
  ctx: { runId: ProviderRunId; now: () => IsoDateTime },
): ReadonlyArray<TurnEvent> {
  switch (provider) {
    case 'cursor':
      return parseCursorStreamLine(line, ctx)
    case 'codex':
      return parseCodexJsonLine(line, ctx)
    case 'gemini':
      return parseGeminiJsonLine(line, ctx)
    default:
      return parseStreamJsonLine(line, ctx)
  }
}

async function startMultiplexedTurnListener(
  now: () => IsoDateTime,
  provider: ProviderId,
): Promise<MultiplexedListener> {
  const states = new Map<string, RunListenerState>()

  const unlistenFn: UnlistenFn = await listen<RawTurnEnvelope>('turn_event', (event) => {
    const payload = event.payload
    const state = states.get(payload.runId)
    if (!state) {
      return
    }

    if (payload.type === 'line' && typeof payload.line === 'string') {
      const ctx = { runId: payload.runId as ProviderRunId, now }
      for (const ev of parseProviderLine(provider, payload.line, ctx)) {
        state.onEvent(ev)
        if (ev.kind === 'file_edit') {
          state.collectedFiles.add(ev.path)
        }
      }
    } else if (payload.type === 'end') {
      const exit = payload.exit_code ?? 0
      const succeeded = exit === 0
      state.onSettle(succeeded ? 'completed' : 'failed', succeeded ? undefined : payload.stderr)
    } else if (payload.type === 'error') {
      state.onSettle('failed', payload.message ?? 'unknown error')
    }
  })

  return {
    unlisten: async () => unlistenFn(),
    registerRun: (runId, st) => {
      states.set(runId, st)
    },
    filesTouchedByRun: (runId) => Array.from(states.get(runId)?.collectedFiles ?? []),
  }
}

type BuildSchedulerDepsArgs = {
  readonly listener: MultiplexedListener
  readonly settleHandlers: Map<
    ProviderRunId,
    {
      promise: Promise<{ status: AgentStatus; error?: string }>
      onEvent: (cb: (e: TurnEvent) => void) => void
    }
  >
}

function buildSchedulerDeps(args: BuildSchedulerDepsArgs): SchedulerDeps {
  const { settleHandlers } = args

  return {
    spawnRun: async (run, onEvent) => {
      const handler = settleHandlers.get(run.runId)
      if (!handler) {
        return { status: 'failed', outputSummary: null, error: 'no settle handler registered' }
      }
      handler.onEvent(onEvent)
      const result = await handler.promise
      return {
        status: result.status,
        outputSummary: null,
        ...(result.error !== undefined && { error: result.error }),
      }
    },
    cancelRun: async (runId) => {
      await cancelTurn(runId).catch(() => undefined)
    },
  }
}

export type RunParallelBranchDeps = {
  readonly now: () => IsoDateTime
  readonly provider: ProviderId
  readonly providerBinary: string | undefined
  readonly model: string
  readonly permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan'
  readonly allowedTools?: ReadonlyArray<string>
  readonly disallowedTools?: ReadonlyArray<string>
  readonly apiKeyEnv?: string
  readonly credentialId?: string
  readonly effects: ParallelBranchEffects
}

export const runParallelBranch = async (
  inputs: ParallelBranchInputs,
  deps: RunParallelBranchDeps,
): Promise<ParallelBranchResult> => {
  const {
    session,
    orchestratingAgentId,
    currentDef,
    groupDefs,
    mergeStrategy,
    maxParallelism,
    workingDir,
  } = inputs
  const { now, effects, provider } = deps

  const cappedDefs = groupDefs.slice(0, Math.max(1, maxParallelism))

  const groupRow = await invokeParallelGroupCreate({
    sessionId: session.id,
    ordinal: currentDef.ordinal,
    mergeStrategy,
    createdAt: now(),
  })
  const groupId = groupRow.id

  const runIds: ProviderRunId[] = cappedDefs.map(() => crypto.randomUUID() as ProviderRunId)
  const promptsByIndex: string[] = cappedDefs.map((def) =>
    buildStepPrompt({
      definition: def,
      carryForwardContext: inputs.carryForwardContext,
      userMessage: inputs.resolvedPromptBase,
    }),
  )

  const listener = await startMultiplexedTurnListener(now, provider)

  const settleResolvers = new Map<
    ProviderRunId,
    (v: { status: AgentStatus; error?: string }) => void
  >()

  const progressCallbacks = new Map<ProviderRunId, ((e: TurnEvent) => void) | null>()

  const settleHandlers = new Map<
    ProviderRunId,
    {
      promise: Promise<{ status: AgentStatus; error?: string }>
      onEvent: (cb: (e: TurnEvent) => void) => void
    }
  >()

  for (const runId of runIds) {
    progressCallbacks.set(runId, null)
    const promise = new Promise<{ status: AgentStatus; error?: string }>((resolve) => {
      settleResolvers.set(runId, resolve)
    })
    settleHandlers.set(runId, {
      promise,
      onEvent: (cb) => {
        progressCallbacks.set(runId, cb)
      },
    })
    listener.registerRun(runId, {
      onEvent: (e) => {
        const cb = progressCallbacks.get(runId)
        if (cb) {
          cb(e)
        }
        effects.appendTurnEvent(orchestratingAgentId, session.id, e)
      },
      onSettle: (status, error) => {
        const r = settleResolvers.get(runId)
        if (r) {
          r({ status, ...(error !== undefined && { error }) })
        }
      },
      collectedFiles: new Set<string>(),
    })
  }

  for (let i = 0; i < cappedDefs.length; i++) {
    const def = cappedDefs[i]!
    const runId = runIds[i]!
    await invokeAgentInsert({
      sessionId: session.id,
      stepId: def.id,
      ordinal: def.ordinal,
      name: def.name,
      status: 'running',
      providerRunId: runId,
      startedAt: now(),
      kind: inferAgentKindFromName(def.name),
    })
  }
  await effects.refreshPhaseRuns(session.id)

  const parallelRuns: ParallelAgent[] = cappedDefs.map((def, i) => ({
    id: crypto.randomUUID() as ParallelAgentId,
    groupId,
    stepId: def.id,
    parallelIndex: i,
    runId: runIds[i]!,
    status: 'running',
    worktreePath: workingDir,
    outputSummary: null,
    startedAt: now(),
    completedAt: null,
  }))

  const spawnPromises = cappedDefs.map(async (_def, i) => {
    const runId = runIds[i]!
    return invokeParallelPhaseRunSpawn({
      groupId,
      runs: [{ runId, workingDir, parallelIndex: i }],
      ...(deps.providerBinary !== undefined && { binary: deps.providerBinary }),
      model: deps.model,
      prompt: promptsByIndex[i]!,
      ...(deps.permissionMode !== undefined && { permissionMode: deps.permissionMode }),
      ...(deps.allowedTools !== undefined && { allowedTools: deps.allowedTools }),
      ...(deps.disallowedTools !== undefined && { disallowedTools: deps.disallowedTools }),
      ...(deps.apiKeyEnv !== undefined && { apiKeyEnv: deps.apiKeyEnv }),
      ...(deps.credentialId !== undefined && { credentialId: deps.credentialId }),
    })
  })

  let handle: SchedulerHandle | null = null
  try {
    await Promise.all(spawnPromises)

    const schedDeps = buildSchedulerDeps({ listener, settleHandlers })
    handle = fanOut(
      schedDeps,
      {
        id: groupId,
        sessionId: session.id,
        ordinal: currentDef.ordinal,
        mergeStrategy,
        createdAt: groupRow.createdAt,
        completedAt: null,
      },
      parallelRuns,
    )

    const merge = await awaitMerge(handle)

    for (let i = 0; i < cappedDefs.length; i++) {
      const def = cappedDefs[i]!
      const runId = runIds[i]!
      const status = merge.runStatuses.find((rs) => rs.runId === runId)
      const phaseRunsAfter = await invokeAgentList(session.id)
      const row = phaseRunsAfter.find((r) => r.runId === runId && r.stepId === def.id)
      if (row) {
        await invokeAgentUpdateStatus(row.id, {
          status: (status?.status ?? 'failed') as AgentStatus,
          completedAt: now(),
        })
      }
    }
    await effects.refreshPhaseRuns(session.id)

    const touches: ReadonlyArray<RunFileTouches> = runIds.map((rid) => ({
      runId: rid,
      files: listener.filesTouchedByRun(rid),
    }))
    const conflicts: ReadonlyArray<FileConflict> = detectConflicts(touches)

    if (conflicts.length > 0) {
      if (mergeStrategy === 'manual') {
        effects.setMergeConflicts(session.id, conflicts)
      } else {
        try {
          await resolveConflicts({
            conflicts,
            runStatuses: merge.runStatuses
              .filter((rs) => rs.status === 'completed')
              .map((rs) => ({ runId: rs.runId, completedAt: now(), status: rs.status })),
            strategy: mergeStrategy,
          })
        } catch (err) {
          if (err instanceof ManualResolutionRequiredError) {
            effects.appendTurnEvent(orchestratingAgentId, session.id, {
              kind: 'error',
              runId: runIds[0]!,
              message: `manual merge resolution required for: ${err.unresolvedFiles.join(', ')}`,
              at: now(),
            })
          } else {
            throw err
          }
        }
      }
    }

    const completedCount = merge.runStatuses.filter((rs) => rs.status === 'completed').length
    const allFailed = completedCount === 0 && merge.runStatuses.length > 0
    const anyFailed = merge.runStatuses.some((rs) => rs.status !== 'completed')

    if (!allFailed) {
      effects.appendTurnEvent(orchestratingAgentId, session.id, {
        kind: 'step_transition',
        runId: runIds[0]!,
        fromStep: { ordinal: currentDef.ordinal, name: currentDef.name },
        toStep: { ordinal: currentDef.ordinal + 1, name: 'next' },
        carryForwardContext: '',
        at: now(),
      })
    }

    if (!allFailed) {
      await invokeParallelGroupUpdateCompletedAt(groupId, now())
    }

    return {
      groupId,
      merge,
      runIds,
      anyFailed,
      allFailed,
    }
  } catch (err) {
    if (handle) {
      await cancelGroup(handle).catch(() => undefined)
    }
    throw err
  } finally {
    await listener.unlisten()
  }
}
