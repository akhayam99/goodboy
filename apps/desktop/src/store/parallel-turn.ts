import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  buildPhasePrompt,
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
} from '@kay-am/core';
import { parseStreamJsonLine } from '@kay-am/core';
import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelPhaseGroupId,
  ParallelPhaseRun,
  ParallelPhaseRunId,
  PhaseDefinition,
  PhaseRunStatus,
  PhaseTemplate,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  Workspace,
} from '@kay-am/types';
import {
  invokeParallelPhaseGroupCreate,
  invokeParallelPhaseGroupUpdateCompletedAt,
  invokePhaseRunInsert,
  invokePhaseRunList,
  invokePhaseRunUpdateStatus,
} from '../phases';
import { invokeParallelPhaseRunSpawn, cancelTurn } from '../turn';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParallelBranchInputs {
  readonly session: Session;
  readonly workspace: Workspace;
  readonly currentDef: PhaseDefinition;
  readonly groupDefs: ReadonlyArray<PhaseDefinition>;
  readonly workingDir: string;
  readonly resolvedPromptBase: string;
  readonly carryForwardContext: string;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly maxParallelism: number;
}

export interface ParallelBranchEffects {
  appendTurnEvent: (sessionId: SessionId, event: TurnEvent) => void;
  refreshPhaseRuns: (sessionId: SessionId) => Promise<void>;
}

export interface ParallelBranchResult {
  readonly groupId: ParallelPhaseGroupId;
  readonly merge: MergeResult;
  readonly runIds: ReadonlyArray<ProviderRunId>;
  readonly anyFailed: boolean;
  readonly allFailed: boolean;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

export interface ParallelDetection {
  readonly currentDef: PhaseDefinition;
  readonly groupDefs: ReadonlyArray<PhaseDefinition>;
}

/**
 * Returns the sibling group iff:
 *  - currentDef has parallelGroup set
 *  - >= 2 sibling definitions share the same parallelGroup
 *  - definitions are sorted by ordinal (deterministic spawn order)
 */
export function detectParallelGroup(
  template: PhaseTemplate,
  currentDef: PhaseDefinition,
): ParallelDetection | null {
  if (currentDef.parallelGroup === undefined) return null;
  const siblings = template.definitions
    .filter((d) => d.parallelGroup === currentDef.parallelGroup)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal);
  if (siblings.length < 2) return null;
  return { currentDef, groupDefs: siblings };
}

// ---------------------------------------------------------------------------
// Listener — multiplexes turn_event envelopes to per-runId callbacks.
// Single global listener, routed by runId — avoids N independent listeners
// (each subscribing to the same Tauri channel) which would be wasteful.
// ---------------------------------------------------------------------------

interface RawTurnEnvelope {
  readonly runId: string;
  readonly type: 'line' | 'end' | 'error';
  readonly line?: string;
  readonly exit_code?: number | null;
  readonly stderr?: string;
  readonly message?: string;
}

interface RunListenerState {
  readonly onEvent: (e: TurnEvent) => void;
  readonly onSettle: (status: PhaseRunStatus, error?: string) => void;
  collectedFiles: Set<string>;
}

export interface MultiplexedListener {
  unlisten: () => Promise<void>;
  registerRun: (runId: ProviderRunId, state: RunListenerState) => void;
  filesTouchedByRun: (runId: ProviderRunId) => ReadonlyArray<string>;
}

export async function startMultiplexedTurnListener(
  now: () => IsoDateTime,
): Promise<MultiplexedListener> {
  const states = new Map<string, RunListenerState>();

  const unlistenFn: UnlistenFn = await listen<RawTurnEnvelope>('turn_event', (event) => {
    const payload = event.payload;
    const state = states.get(payload.runId);
    if (!state) return;

    if (payload.type === 'line' && typeof payload.line === 'string') {
      const ctx = { runId: payload.runId as ProviderRunId, now };
      for (const ev of parseStreamJsonLine(payload.line, ctx)) {
        state.onEvent(ev);
        if (ev.kind === 'file_edit') state.collectedFiles.add(ev.path);
      }
    } else if (payload.type === 'end') {
      const exit = payload.exit_code ?? 0;
      state.onSettle(exit === 0 ? 'completed' : 'failed', exit !== 0 ? payload.stderr : undefined);
    } else if (payload.type === 'error') {
      state.onSettle('failed', payload.message ?? 'unknown error');
    }
  });

  return {
    unlisten: async () => unlistenFn(),
    registerRun: (runId, st) => {
      states.set(runId, st);
    },
    filesTouchedByRun: (runId) => Array.from(states.get(runId)?.collectedFiles ?? []),
  };
}

// ---------------------------------------------------------------------------
// Scheduler deps factory — design (b): pre-batch via invokeParallelPhaseRunSpawn,
// scheduler.spawnRun resolves on per-runId 'end' envelope. Aligns with T2 (#208)
// batched spawn design and keeps the scheduler purely an await-only orchestrator.
// ---------------------------------------------------------------------------

export interface BuildSchedulerDepsArgs {
  readonly listener: MultiplexedListener;
  readonly settleHandlers: Map<
    ProviderRunId,
    {
      promise: Promise<{ status: PhaseRunStatus; error?: string }>;
      onEvent: (cb: (e: TurnEvent) => void) => void;
    }
  >;
}

export function buildSchedulerDeps(args: BuildSchedulerDepsArgs): SchedulerDeps {
  const { settleHandlers } = args;

  return {
    spawnRun: async (run, onEvent) => {
      const handler = settleHandlers.get(run.runId);
      if (!handler) {
        // Should be impossible — every run has a pre-registered handler.
        return { status: 'failed', outputSummary: null, error: 'no settle handler registered' };
      }
      handler.onEvent(onEvent);
      const result = await handler.promise;
      return {
        status: result.status,
        outputSummary: null,
        ...(result.error !== undefined && { error: result.error }),
      };
    },
    cancelRun: async (runId) => {
      await cancelTurn(runId).catch(() => undefined);
    },
  };
}

// ---------------------------------------------------------------------------
// Main entry — orchestrates the parallel branch end-to-end.
// ---------------------------------------------------------------------------

export interface RunParallelBranchDeps {
  readonly now: () => IsoDateTime;
  readonly providerBinary: string | undefined;
  readonly model: string;
  readonly permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
  readonly effects: ParallelBranchEffects;
}

export async function runParallelBranch(
  inputs: ParallelBranchInputs,
  deps: RunParallelBranchDeps,
): Promise<ParallelBranchResult> {
  const { session, currentDef, groupDefs, mergeStrategy, maxParallelism, workingDir } = inputs;
  const { now, effects } = deps;

  // Cap by maxParallelism — defensive guard; UI clamps but accept any spec list.
  const cappedDefs = groupDefs.slice(0, Math.max(1, maxParallelism));

  // Persist parallel group up front so the audit trail captures it even if spawn fails.
  const groupRow = await invokeParallelPhaseGroupCreate({
    sessionId: session.id,
    ordinal: currentDef.ordinal,
    mergeStrategy,
    createdAt: now(),
  });
  const groupId = groupRow.id;

  // Generate runIds + per-def prompts up front. Same ID flows through every layer.
  const runIds: ProviderRunId[] = cappedDefs.map(() => crypto.randomUUID() as ProviderRunId);
  const promptsByIndex: string[] = cappedDefs.map((def) =>
    buildPhasePrompt({
      definition: def,
      carryForwardContext: inputs.carryForwardContext,
      userMessage: inputs.resolvedPromptBase,
    }),
  );

  // Boot listener BEFORE spawn — race-free: events arrive only after spawn.
  const listener = await startMultiplexedTurnListener(now);

  const settleResolvers = new Map<
    ProviderRunId,
    (v: { status: PhaseRunStatus; error?: string }) => void
  >();

  // Per-run scheduler progress callbacks — set by scheduler.spawnRun, invoked by
  // listener. Listener registration must happen up front (before spawn) so no
  // events leak before scheduler subscribes. Until spawnRun fires, scheduler
  // progress callbacks are absent — benign because scheduler progress fan-out is
  // best-effort UI plumbing; the canonical transcript stream still flows via
  // appendTurnEvent below.
  const progressCallbacks = new Map<ProviderRunId, ((e: TurnEvent) => void) | null>();

  // Per-run settle handlers — promise resolves when listener observes 'end'/'error'
  // for the matching runId. scheduler.spawnRun awaits the promise; onEvent stores
  // the scheduler's progress callback for the listener to dispatch into.
  const settleHandlers = new Map<
    ProviderRunId,
    {
      promise: Promise<{ status: PhaseRunStatus; error?: string }>;
      onEvent: (cb: (e: TurnEvent) => void) => void;
    }
  >();

  for (const runId of runIds) {
    progressCallbacks.set(runId, null);
    const promise = new Promise<{ status: PhaseRunStatus; error?: string }>((resolve) => {
      settleResolvers.set(runId, resolve);
    });
    settleHandlers.set(runId, {
      promise,
      onEvent: (cb) => {
        progressCallbacks.set(runId, cb);
      },
    });
    listener.registerRun(runId, {
      onEvent: (e) => {
        const cb = progressCallbacks.get(runId);
        if (cb) cb(e);
        effects.appendTurnEvent(session.id, e);
      },
      onSettle: (status, error) => {
        const r = settleResolvers.get(runId);
        if (r) r({ status, ...(error !== undefined && { error }) });
      },
      collectedFiles: new Set<string>(),
    });
  }

  // Persist N phase_runs rows (status=running). Using the existing single-run
  // invoker — group_id remains NULL for now (Rust insert doesn't accept it yet),
  // but session_id+ordinal+phaseDefinitionId still uniquely identifies each run.
  for (let i = 0; i < cappedDefs.length; i++) {
    const def = cappedDefs[i]!;
    const runId = runIds[i]!;
    await invokePhaseRunInsert({
      sessionId: session.id,
      phaseDefinitionId: def.id,
      ordinal: def.ordinal,
      name: def.name,
      status: 'running',
      providerRunId: runId,
      startedAt: now(),
    });
  }
  await effects.refreshPhaseRuns(session.id);

  // Build ParallelPhaseRun records the scheduler operates on. parallelIndex
  // matches the spec's order. We DO NOT wire createParallelWorktrees here — the
  // issue scope keeps worktree-per-run out of v1: every run executes in the
  // session's primary worktree (existing single-run invariant). Workdir
  // collisions are still surfaced by detectConflicts via emitted file_edit events.
  // TODO (@ak, #212-followup): wire createParallelWorktrees + per-run workingDir
  // once Rust phase_run_insert accepts (group_id, parallel_index).
  const parallelRuns: ParallelPhaseRun[] = cappedDefs.map((def, i) => ({
    id: crypto.randomUUID() as ParallelPhaseRunId,
    groupId,
    phaseDefinitionId: def.id,
    parallelIndex: i,
    runId: runIds[i]!,
    status: 'running',
    worktreePath: workingDir,
    outputSummary: null,
    startedAt: now(),
    completedAt: null,
  }));

  // Pre-batch spawn — keeps registration atomic on the rust side. Per-run prompts
  // differ, so we issue one invokeParallelPhaseRunSpawn PER definition with a single
  // run each. (T2's batch invoker is designed for same-prompt fan-out; here each
  // run has a distinct prompt because each is a different phase definition.)
  const spawnPromises = cappedDefs.map(async (_def, i) => {
    const runId = runIds[i]!;
    return invokeParallelPhaseRunSpawn({
      groupId,
      runs: [{ runId, workingDir, parallelIndex: i }],
      ...(deps.providerBinary !== undefined && { binary: deps.providerBinary }),
      model: deps.model,
      prompt: promptsByIndex[i]!,
      ...(deps.permissionMode !== undefined && { permissionMode: deps.permissionMode }),
      ...(deps.allowedTools !== undefined && { allowedTools: deps.allowedTools }),
      ...(deps.disallowedTools !== undefined && { disallowedTools: deps.disallowedTools }),
    });
  });

  let handle: SchedulerHandle | null = null;
  try {
    await Promise.all(spawnPromises);

    const schedDeps = buildSchedulerDeps({ listener, settleHandlers });
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
    );

    const merge = await awaitMerge(handle);

    // Update each phase_run row with terminal status.
    for (let i = 0; i < cappedDefs.length; i++) {
      const def = cappedDefs[i]!;
      const runId = runIds[i]!;
      const status = merge.runStatuses.find((rs) => rs.runId === runId);
      const phaseRunsAfter = await invokePhaseRunList(session.id);
      const row = phaseRunsAfter.find((r) => r.runId === runId && r.phaseDefinitionId === def.id);
      if (row) {
        await invokePhaseRunUpdateStatus(row.id, {
          status: (status?.status ?? 'failed') as PhaseRunStatus,
          completedAt: now(),
        });
      }
    }
    await effects.refreshPhaseRuns(session.id);

    // Conflict detection + auto-resolve.
    // Auto-resolution path only — manual MergeDialog wiring is deferred. Reason:
    // surfacing conflicts to the user requires emitting MergeResult into ChatView
    // state (currently a TODO placeholder in MergeDialog). Default to the group's
    // mergeStrategy; if 'manual' and unresolved, swallow the rejection and emit
    // a warning event so the parallel branch never blocks the turn pipeline.
    // TODO (@ak, #212-followup): plumb MergeResult to ChatView and gate completion
    // on user picks for mergeStrategy === 'manual'.
    const touches: ReadonlyArray<RunFileTouches> = runIds.map((rid) => ({
      runId: rid,
      files: listener.filesTouchedByRun(rid),
    }));
    const conflicts: ReadonlyArray<FileConflict> = detectConflicts(touches);

    if (conflicts.length > 0) {
      try {
        await resolveConflicts({
          conflicts,
          runStatuses: merge.runStatuses
            .filter((rs) => rs.status === 'completed')
            .map((rs) => ({ runId: rs.runId, completedAt: now(), status: rs.status })),
          strategy: mergeStrategy,
        });
      } catch (err) {
        if (err instanceof ManualResolutionRequiredError) {
          effects.appendTurnEvent(session.id, {
            kind: 'error',
            runId: runIds[0]!,
            message: `manual merge resolution required for: ${err.unresolvedFiles.join(', ')}`,
            at: now(),
          });
        } else {
          throw err;
        }
      }
    }

    const completedCount = merge.runStatuses.filter((rs) => rs.status === 'completed').length;
    const allFailed = completedCount === 0 && merge.runStatuses.length > 0;
    const anyFailed = merge.runStatuses.some((rs) => rs.status !== 'completed');

    // Emit synthetic phase_transition marking sync-point completion.
    // We use the first runId for routing; UI treats parallel groups as one phase boundary.
    if (!allFailed) {
      effects.appendTurnEvent(session.id, {
        kind: 'phase_transition',
        runId: runIds[0]!,
        fromPhase: { ordinal: currentDef.ordinal, name: currentDef.name },
        toPhase: { ordinal: currentDef.ordinal + 1, name: 'next' },
        carryForwardContext: '',
        at: now(),
      });
    }

    // Mark group complete only when at least one run completed. allFailed runs
    // leave completedAt NULL so the user can inspect/retry without rolling up.
    if (!allFailed) {
      await invokeParallelPhaseGroupUpdateCompletedAt(groupId, now());
    }

    return {
      groupId,
      merge,
      runIds,
      anyFailed,
      allFailed,
    };
  } catch (err) {
    if (handle) {
      await cancelGroup(handle).catch(() => undefined);
    }
    throw err;
  } finally {
    await listener.unlisten();
  }
}
