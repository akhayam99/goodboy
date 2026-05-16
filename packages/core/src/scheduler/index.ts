import type {
  ParallelGroup,
  ParallelGroupId,
  ParallelAgent,
  ParallelMergeStrategy,
  AgentStatus,
  ProviderRunId,
  TurnEvent,
} from '@kay-am/types';

export {
  detectConflicts,
  resolveConflicts,
  ManualResolutionRequiredError,
  type RunFileTouches,
  type FileConflict,
  type ResolvedConflict,
  type ConflictResolutionInput,
} from './conflict';

export type UnsubscribeFn = () => void;

export interface SchedulerDeps {
  spawnRun: (
    run: ParallelAgent,
    onEvent: (e: TurnEvent) => void,
  ) => Promise<{ status: AgentStatus; outputSummary: string | null; error?: string }>;
  cancelRun: (runId: ProviderRunId) => Promise<void>;
}

export interface SchedulerProgress {
  runId: ProviderRunId;
  event: TurnEvent;
}

export interface MergeResult {
  groupId: ParallelGroupId;
  runStatuses: ReadonlyArray<{
    runId: ProviderRunId;
    status: AgentStatus;
    outputSummary: string | null;
    error?: string;
  }>;
  mergeStrategy: ParallelMergeStrategy;
}

interface RunEntry {
  run: ParallelAgent;
  runId: ProviderRunId;
}

// SchedulerHandle is opaque — callers only pass it back into scheduler fns.
// Internals: settled promise per run, shared listener set for progress.
export interface SchedulerHandle {
  readonly groupId: ParallelGroupId;
  readonly runEntries: ReadonlyArray<RunEntry>;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly deps: SchedulerDeps;
  readonly settled: Promise<MergeResult>;
  readonly progressListeners: Set<(p: SchedulerProgress) => void>;
}

export function fanOut(
  deps: SchedulerDeps,
  group: ParallelGroup,
  runs: ReadonlyArray<ParallelAgent>,
): SchedulerHandle {
  const progressListeners: Set<(p: SchedulerProgress) => void> = new Set();

  const runEntries: RunEntry[] = runs.map((run) => ({ run, runId: run.runId }));

  const runPromises = runs.map((run) =>
    deps
      .spawnRun(run, (event) => {
        for (const cb of progressListeners) {
          cb({ runId: run.runId, event });
        }
      })
      .then(
        (result) => ({ runId: run.runId, ...result }),
        // spawnRun should not reject — but if it does, treat as failed run
        (err: unknown) => ({
          runId: run.runId,
          status: 'failed' as AgentStatus,
          outputSummary: null,
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
  );

  const settled: Promise<MergeResult> = Promise.all(runPromises).then((statuses) => ({
    groupId: group.id,
    runStatuses: statuses,
    mergeStrategy: group.mergeStrategy,
  }));

  return {
    groupId: group.id,
    runEntries,
    mergeStrategy: group.mergeStrategy,
    deps,
    settled,
    progressListeners,
  };
}

export async function awaitMerge(handle: SchedulerHandle): Promise<MergeResult> {
  return handle.settled;
}

export function onProgress(
  handle: SchedulerHandle,
  cb: (p: SchedulerProgress) => void,
): UnsubscribeFn {
  handle.progressListeners.add(cb);
  return () => {
    handle.progressListeners.delete(cb);
  };
}

export async function cancelGroup(handle: SchedulerHandle): Promise<void> {
  await Promise.allSettled(handle.runEntries.map(({ runId }) => handle.deps.cancelRun(runId)));
}
