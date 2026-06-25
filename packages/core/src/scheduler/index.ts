import type {
  ParallelGroup,
  ParallelGroupId,
  ParallelAgent,
  ParallelMergeStrategy,
  AgentStatus,
  ProviderRunId,
  TurnEvent,
} from '@goodboy/types'

export {
  detectConflicts,
  resolveConflicts,
  ManualResolutionRequiredError,
  type RunFileTouches,
  type FileConflict,
  type ResolvedConflict,
  type ConflictResolutionInput,
} from './conflict'

export type UnsubscribeFn = () => void

export type SchedulerDeps = {
  spawnRun: (
    run: ParallelAgent,
    onEvent: (e: TurnEvent) => void,
  ) => Promise<{ status: AgentStatus; outputSummary: string | null; error?: string }>
  cancelRun: (runId: ProviderRunId) => Promise<void>
}

export type SchedulerProgress = {
  runId: ProviderRunId
  event: TurnEvent
}

export type MergeResult = {
  groupId: ParallelGroupId
  runStatuses: ReadonlyArray<{
    runId: ProviderRunId
    status: AgentStatus
    outputSummary: string | null
    error?: string
  }>
  mergeStrategy: ParallelMergeStrategy
}

type RunEntry = {
  run: ParallelAgent
  runId: ProviderRunId
}

export type SchedulerHandle = {
  readonly groupId: ParallelGroupId
  readonly runEntries: ReadonlyArray<RunEntry>
  readonly mergeStrategy: ParallelMergeStrategy
  readonly deps: SchedulerDeps
  readonly settled: Promise<MergeResult>
  readonly progressListeners: Set<(p: SchedulerProgress) => void>
}

export const fanOut = (
  deps: SchedulerDeps,
  group: ParallelGroup,
  runs: ReadonlyArray<ParallelAgent>,
): SchedulerHandle => {
  const progressListeners: Set<(p: SchedulerProgress) => void> = new Set()

  const runEntries: RunEntry[] = runs.map((run) => ({ run, runId: run.runId }))

  const runPromises = runs.map((run) =>
    deps
      .spawnRun(run, (event) => {
        for (const cb of progressListeners) {
          cb({ runId: run.runId, event })
        }
      })
      .then(
        (result) => ({ runId: run.runId, ...result }),
        (err: unknown) => ({
          runId: run.runId,
          status: 'failed' as AgentStatus,
          outputSummary: null,
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
  )

  const settled: Promise<MergeResult> = Promise.all(runPromises).then((statuses) => ({
    groupId: group.id,
    runStatuses: statuses,
    mergeStrategy: group.mergeStrategy,
  }))

  return {
    groupId: group.id,
    runEntries,
    mergeStrategy: group.mergeStrategy,
    deps,
    settled,
    progressListeners,
  }
}

export const awaitMerge = async (handle: SchedulerHandle): Promise<MergeResult> => {
  return handle.settled
}

export const onProgress = (
  handle: SchedulerHandle,
  cb: (p: SchedulerProgress) => void,
): UnsubscribeFn => {
  handle.progressListeners.add(cb)
  return () => {
    handle.progressListeners.delete(cb)
  }
}

export const cancelGroup = async (handle: SchedulerHandle): Promise<void> => {
  await Promise.allSettled(handle.runEntries.map(({ runId }) => handle.deps.cancelRun(runId)))
}
