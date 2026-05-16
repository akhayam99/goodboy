import { listen, type UnlistenFn } from '@tauri-apps/api/event';
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
} from '@kay-am/core';
import { parseStreamJsonLine } from '@kay-am/core';
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

export interface ParallelBranchInputs {
  readonly session: Session;
  readonly orchestratingAgentId: AgentId;
  readonly workspace: Workspace;
  readonly currentDef: Step;
  readonly groupDefs: ReadonlyArray<Step>;
  readonly workingDir: string;
  readonly resolvedPromptBase: string;
  readonly carryForwardContext: string;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly maxParallelism: number;
}

export interface ParallelBranchEffects {
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
  refreshPhaseRuns: (sessionId: SessionId) => Promise<void>;
  setMergeConflicts: (sessionId: SessionId, conflicts: ReadonlyArray<FileConflict>) => void;
}

export interface ParallelBranchResult {
  readonly groupId: ParallelGroupId;
  readonly merge: MergeResult;
  readonly runIds: ReadonlyArray<ProviderRunId>;
  readonly anyFailed: boolean;
  readonly allFailed: boolean;
}

export interface ParallelDetection {
  readonly currentDef: Step;
  readonly groupDefs: ReadonlyArray<Step>;
}

/**
 * Returns the sibling group iff:
 *  - currentDef has parallelGroup set
 *  - >= 2 sibling steps share the same parallelGroup
 *  - steps are sorted by ordinal (deterministic spawn order)
 */
export function detectParallelGroup(
  template: Workflow,
  currentDef: Step,
): ParallelDetection | null {
  if (currentDef.parallelGroup === undefined) return null;
  const siblings = template.steps
    .filter((d) => d.parallelGroup === currentDef.parallelGroup)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal);
  if (siblings.length < 2) return null;
  return { currentDef, groupDefs: siblings };
}

// Multiplexes turn_event envelopes to per-runId callbacks. Single global
// listener routed by runId — N independent listeners on the same Tauri
// channel would be wasteful.
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
  readonly onSettle: (status: AgentStatus, error?: string) => void;
  collectedFiles: Set<string>;
}

interface MultiplexedListener {
  unlisten: () => Promise<void>;
  registerRun: (runId: ProviderRunId, state: RunListenerState) => void;
  filesTouchedByRun: (runId: ProviderRunId) => ReadonlyArray<string>;
}

async function startMultiplexedTurnListener(now: () => IsoDateTime): Promise<MultiplexedListener> {
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
      const succeeded = exit === 0;
      state.onSettle(succeeded ? 'completed' : 'failed', succeeded ? undefined : payload.stderr);
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

// Scheduler deps factory — design (b): pre-batch via invokeParallelPhaseRunSpawn,
// scheduler.spawnRun resolves on per-runId 'end' envelope. Aligns with T2 (#208)
// batched spawn design and keeps the scheduler purely an await-only orchestrator.
interface BuildSchedulerDepsArgs {
  readonly listener: MultiplexedListener;
  readonly settleHandlers: Map<
    ProviderRunId,
    {
      promise: Promise<{ status: AgentStatus; error?: string }>;
      onEvent: (cb: (e: TurnEvent) => void) => void;
    }
  >;
}

function buildSchedulerDeps(args: BuildSchedulerDepsArgs): SchedulerDeps {
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
  const {
    session,
    orchestratingAgentId,
    currentDef,
    groupDefs,
    mergeStrategy,
    maxParallelism,
    workingDir,
  } = inputs;
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
    buildStepPrompt({
      definition: def,
      carryForwardContext: inputs.carryForwardContext,
      userMessage: inputs.resolvedPromptBase,
    }),
  );

  // Boot listener BEFORE spawn — race-free: events arrive only after spawn.
  const listener = await startMultiplexedTurnListener(now);

  const settleResolvers = new Map<
    ProviderRunId,
    (v: { status: AgentStatus; error?: string }) => void
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
      promise: Promise<{ status: AgentStatus; error?: string }>;
      onEvent: (cb: (e: TurnEvent) => void) => void;
    }
  >();

  for (const runId of runIds) {
    progressCallbacks.set(runId, null);
    const promise = new Promise<{ status: AgentStatus; error?: string }>((resolve) => {
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
        effects.appendTurnEvent(orchestratingAgentId, session.id, e);
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
  // but session_id+ordinal+stepId still uniquely identifies each run.
  for (let i = 0; i < cappedDefs.length; i++) {
    const def = cappedDefs[i]!;
    const runId = runIds[i]!;
    await invokePhaseRunInsert({
      sessionId: session.id,
      stepId: def.id,
      ordinal: def.ordinal,
      name: def.name,
      status: 'running',
      providerRunId: runId,
      startedAt: now(),
    });
  }
  await effects.refreshPhaseRuns(session.id);

  // Build ParallelAgent records the scheduler operates on. parallelIndex
  // matches the spec's order. We DO NOT wire createParallelWorktrees here — the
  // issue scope keeps worktree-per-run out of v1: every run executes in the
  // session's primary worktree (existing single-run invariant). Workdir
  // collisions are still surfaced by detectConflicts via emitted file_edit events.
  // TODO (@ak, #414): wire createParallelWorktrees + per-run workingDir
  // once Rust phase_run_insert accepts (group_id, parallel_index).
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

    for (let i = 0; i < cappedDefs.length; i++) {
      const def = cappedDefs[i]!;
      const runId = runIds[i]!;
      const status = merge.runStatuses.find((rs) => rs.runId === runId);
      const phaseRunsAfter = await invokePhaseRunList(session.id);
      const row = phaseRunsAfter.find((r) => r.runId === runId && r.stepId === def.id);
      if (row) {
        await invokePhaseRunUpdateStatus(row.id, {
          status: (status?.status ?? 'failed') as AgentStatus,
          completedAt: now(),
        });
      }
    }
    await effects.refreshPhaseRuns(session.id);

    // Auto-resolution path only — manual MergeDialog wiring is deferred. Reason:
    // surfacing conflicts to the user requires emitting MergeResult into ChatView
    // state (currently a TODO placeholder in MergeDialog). Default to the group's
    // mergeStrategy; if 'manual' and unresolved, swallow the rejection and emit
    // a warning event so the parallel branch never blocks the turn pipeline.
    // TODO (@ak, #415): plumb MergeResult to ChatView and gate completion
    // on user picks for mergeStrategy === 'manual'.
    const touches: ReadonlyArray<RunFileTouches> = runIds.map((rid) => ({
      runId: rid,
      files: listener.filesTouchedByRun(rid),
    }));
    const conflicts: ReadonlyArray<FileConflict> = detectConflicts(touches);

    if (conflicts.length > 0) {
      if (mergeStrategy === 'manual') {
        // Surface conflicts to UI via store — ChatView will open MergeDialog.
        effects.setMergeConflicts(session.id, conflicts);
      } else {
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
            effects.appendTurnEvent(orchestratingAgentId, session.id, {
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
    }

    const completedCount = merge.runStatuses.filter((rs) => rs.status === 'completed').length;
    const allFailed = completedCount === 0 && merge.runStatuses.length > 0;
    const anyFailed = merge.runStatuses.some((rs) => rs.status !== 'completed');

    // Emit synthetic phase_transition marking sync-point completion.
    // We use the first runId for routing; UI treats parallel groups as one phase boundary.
    if (!allFailed) {
      effects.appendTurnEvent(orchestratingAgentId, session.id, {
        kind: 'step_transition',
        runId: runIds[0]!,
        fromStep: { ordinal: currentDef.ordinal, name: currentDef.name },
        toStep: { ordinal: currentDef.ordinal + 1, name: 'next' },
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
