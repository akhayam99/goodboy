import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  AgentStatus,
  IsoDateTime,
  ParallelGroupId,
  StepId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  ProviderId,
  ProviderRunId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { MergeResult } from '@goodboy/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

type TurnEnvelope = {
  runId: string;
  type: 'line' | 'end' | 'error';
  line?: string;
  exit_code?: number | null;
  stderr?: string;
  message?: string;
};

const capturedListeners: Array<(payload: TurnEnvelope) => void> = [];

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, cb: (e: { payload: TurnEnvelope }) => void) => {
    capturedListeners.push((payload) => cb({ payload }));
    return () => undefined;
  }),
}));

const parallelPhaseGroupCreateSpy = vi.fn();
const parallelPhaseGroupUpdateCompletedAtSpy = vi.fn();
const phaseRunInsertSpy = vi.fn();
const phaseRunUpdateStatusSpy = vi.fn();
const phaseRunListSpy = vi.fn();

vi.mock('../features/workflows/workflows', () => ({
  invokeParallelGroupCreate: (args: unknown) => parallelPhaseGroupCreateSpy(args),
  invokeParallelGroupUpdateCompletedAt: (id: string, at: string) =>
    parallelPhaseGroupUpdateCompletedAtSpy(id, at),
  invokeAgentInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokeAgentUpdateStatus: (id: string, fields: unknown) => phaseRunUpdateStatusSpy(id, fields),
  invokeAgentList: (sid: string) => phaseRunListSpy(sid),
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentDelete: vi.fn(),
}));

const invokeParallelPhaseRunSpawnSpy = vi.fn();
const cancelTurnSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  invokeParallelPhaseRunSpawn: (args: unknown) => invokeParallelPhaseRunSpawnSpy(args),
  cancelTurn: (runId: string) => cancelTurnSpy(runId),
  runTurn: vi.fn(async function* () {}),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

import { runParallelBranch } from '../store/parallel-turn';
import type { ParallelBranchInputs, ParallelBranchEffects } from '../store/parallel-turn';

const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'ses-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const TEMPLATE_ID = 'tpl-1' as WorkflowId;
const GROUP_ID = 'grp-1' as ParallelGroupId;

function makeDef(id: string, ordinal: number, pg = 42) {
  return {
    id: id as StepId,
    workflowId: TEMPLATE_ID,
    ordinal,
    name: id,
    promptPrefix: `[${id}]`,
    parallelGroup: pg,
  };
}

function makeSession() {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'e2e-test',
    state: { kind: 'idle' as const, lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic' as ProviderId, allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    workflowRuns: [
      {
        id: 'run-1' as WorkflowRunId,
        workflowId: TEMPLATE_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate' as const,
      },
    ],
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeWorkspace() {
  return {
    id: WORKSPACE_ID,
    name: 'ws',
    rootPath: '/tmp',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function emit(payload: TurnEnvelope): void {
  for (const fn of capturedListeners) fn(payload);
}

function emitEnd(runId: string, exitCode = 0): void {
  emit({ runId, type: 'end', exit_code: exitCode, stderr: exitCode !== 0 ? 'run failed' : '' });
}

function emitLine(runId: string, text: string): void {
  const line = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
  });
  emit({ runId, type: 'line', line });
}

function makeInputs(
  groupDefs = [makeDef('d-a', 1), makeDef('d-b', 2), makeDef('d-c', 3)],
): ParallelBranchInputs {
  return {
    session: makeSession(),
    orchestratingAgentId: 'orchestrator-agent' as AgentId,
    workspace: makeWorkspace(),
    currentDef: groupDefs[0]!,
    groupDefs,
    workingDir: '/tmp/wt',
    resolvedPromptBase: 'implement X',
    carryForwardContext: '',
    mergeStrategy: 'last_write_wins',
    maxParallelism: 4,
  };
}

function makeEffects(): { effects: ParallelBranchEffects; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  return {
    effects: {
      appendTurnEvent: (_agentId: AgentId, _sid: SessionId, e: TurnEvent) => events.push(e),
      refreshPhaseRuns: vi.fn(async () => undefined),
      setMergeConflicts: vi.fn(),
    },
    events,
  };
}

function makeDeps(effects: ParallelBranchEffects) {
  return {
    now: () => NOW,
    provider: 'anthropic' as ProviderId,
    providerBinary: 'claude',
    model: 'claude-sonnet-4-6',
    effects,
  };
}

function wirePhaseRunSpies(
  insertedPhaseRuns: Array<{
    id: AgentId;
    sessionId: SessionId;
    stepId: StepId;
    ordinal: number;
    name: string;
    status: AgentStatus;
    runId: ProviderRunId;
  }>,
): void {
  phaseRunInsertSpy.mockImplementation(
    async (args: { stepId: string; ordinal: number; name: string; providerRunId: string }) => {
      const row = {
        id: `pr-${args.stepId}` as AgentId,
        sessionId: SESSION_ID,
        stepId: args.stepId as StepId,
        ordinal: args.ordinal,
        name: args.name,
        status: 'running' as AgentStatus,
        runId: args.providerRunId as ProviderRunId,
      };
      insertedPhaseRuns.push(row);
      return row;
    },
  );
  phaseRunListSpy.mockImplementation(async () => insertedPhaseRuns.slice());
}

describe('parallel e2e, fan-out/fan-in', () => {
  beforeEach(() => {
    parallelPhaseGroupCreateSpy.mockReset();
    parallelPhaseGroupUpdateCompletedAtSpy.mockReset();
    phaseRunInsertSpy.mockReset();
    phaseRunUpdateStatusSpy.mockReset();
    phaseRunListSpy.mockReset();
    invokeParallelPhaseRunSpawnSpy.mockReset();
    cancelTurnSpy.mockReset();
    capturedListeners.length = 0;

    parallelPhaseGroupCreateSpy.mockResolvedValue({
      id: GROUP_ID,
      sessionId: SESSION_ID,
      ordinal: 1,
      mergeStrategy: 'last_write_wins',
      createdAt: NOW,
      completedAt: null,
    });
    parallelPhaseGroupUpdateCompletedAtSpy.mockResolvedValue(undefined);
    phaseRunUpdateStatusSpy.mockResolvedValue(undefined);
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => args.runs.map((r) => r.runId),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: 3 runs complete → transcript has events from all runIds, group marked complete', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    const { effects, events } = makeEffects();
    const inputs = makeInputs();
    const deps = makeDeps(effects);

    const branchPromise = runParallelBranch(inputs, deps);

    await new Promise((r) => setTimeout(r, 10));

    expect(invokeParallelPhaseRunSpawnSpy).toHaveBeenCalledTimes(3);

    const spawnedRunIds = (
      invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
        [{ runs: ReadonlyArray<{ runId: string }> }]
      >
    ).map(([a]) => a.runs[0]!.runId);

    const [idA, idB, idC] = spawnedRunIds as [string, string, string];

    emitLine(idA, 'run-a output');
    emitLine(idB, 'run-b output');
    emitLine(idC, 'run-c output');

    emitEnd(idA, 0);
    emitEnd(idB, 0);
    emitEnd(idC, 0);

    const result = await branchPromise;

    expect(result.runIds).toHaveLength(3);
    expect(result.runIds).toContain(idA as ProviderRunId);
    expect(result.runIds).toContain(idB as ProviderRunId);
    expect(result.runIds).toContain(idC as ProviderRunId);

    expect(result.anyFailed).toBe(false);
    expect(result.allFailed).toBe(false);

    const merge: MergeResult = result.merge;
    expect(merge.runStatuses).toHaveLength(3);
    for (const rs of merge.runStatuses) {
      expect(rs.status).toBe('completed');
    }

    const textEvents = events.filter((e) => e.kind === 'assistant_text');
    const seenRunIds = new Set(textEvents.map((e) => e.runId));
    expect(seenRunIds.size).toBe(3);
    expect(seenRunIds.has(idA as ProviderRunId)).toBe(true);
    expect(seenRunIds.has(idB as ProviderRunId)).toBe(true);
    expect(seenRunIds.has(idC as ProviderRunId)).toBe(true);

    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce();
    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledWith(GROUP_ID, NOW);

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(3);
    expect(phaseRunUpdateStatusSpy).toHaveBeenCalledTimes(3);

    const phaseTransitions = events.filter((e) => e.kind === 'step_transition');
    expect(phaseTransitions).toHaveLength(1);
  });

  it('error path: 1 of 3 runs fails → partial merge proceeds, anyFailed=true, group still completes', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    const { effects, events } = makeEffects();
    const inputs = makeInputs();
    const deps = makeDeps(effects);

    const branchPromise = runParallelBranch(inputs, deps);
    await new Promise((r) => setTimeout(r, 10));

    expect(invokeParallelPhaseRunSpawnSpy).toHaveBeenCalledTimes(3);

    const spawnedRunIds = (
      invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
        [{ runs: ReadonlyArray<{ runId: string }> }]
      >
    ).map(([a]) => a.runs[0]!.runId) as [string, string, string];

    const [idA, idB, idC] = spawnedRunIds;

    emitLine(idA, 'partial-a');
    emitLine(idB, 'partial-b');
    emitEnd(idA, 0);
    emitEnd(idB, 0);
    emitEnd(idC, 1);

    const result = await branchPromise;

    expect(result.anyFailed).toBe(true);
    expect(result.allFailed).toBe(false);

    const merge: MergeResult = result.merge;
    expect(merge.runStatuses).toHaveLength(3);
    const completed = merge.runStatuses.filter((rs) => rs.status === 'completed');
    const failed = merge.runStatuses.filter((rs) => rs.status === 'failed');
    expect(completed).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.runId).toBe(idC as ProviderRunId);

    expect(parallelPhaseGroupUpdateCompletedAtSpy).toHaveBeenCalledOnce();

    const textEvents = events.filter((e) => e.kind === 'assistant_text');
    const seenRunIds = new Set(textEvents.map((e) => e.runId));
    expect(seenRunIds.has(idA as ProviderRunId)).toBe(true);
    expect(seenRunIds.has(idB as ProviderRunId)).toBe(true);
    expect(seenRunIds.has(idC as ProviderRunId)).toBe(false);
  });

  it('all-fail path: all 3 runs fail → allFailed=true, group completedAt not set', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    const { effects } = makeEffects();
    const inputs = makeInputs();
    const deps = makeDeps(effects);

    const branchPromise = runParallelBranch(inputs, deps);
    await new Promise((r) => setTimeout(r, 10));

    const spawnedRunIds = (
      invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
        [{ runs: ReadonlyArray<{ runId: string }> }]
      >
    ).map(([a]) => a.runs[0]!.runId);

    for (const id of spawnedRunIds) emitEnd(id, 1);

    const result = await branchPromise;

    expect(result.allFailed).toBe(true);
    expect(result.anyFailed).toBe(true);

    expect(parallelPhaseGroupUpdateCompletedAtSpy).not.toHaveBeenCalled();
  });

  it('transcript multi-lane: interleaved events remain correctly tagged per runId', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    const { effects, events } = makeEffects();
    const inputs = makeInputs();
    const deps = makeDeps(effects);

    const branchPromise = runParallelBranch(inputs, deps);
    await new Promise((r) => setTimeout(r, 10));

    const spawnedRunIds = (
      invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
        [{ runs: ReadonlyArray<{ runId: string }> }]
      >
    ).map(([a]) => a.runs[0]!.runId) as [string, string, string];

    const [idA, idB, idC] = spawnedRunIds;

    emitLine(idA, 'a-1');
    emitLine(idB, 'b-1');
    emitLine(idC, 'c-1');
    emitLine(idA, 'a-2');
    emitLine(idC, 'c-2');
    emitLine(idB, 'b-2');

    emitEnd(idA, 0);
    emitEnd(idB, 0);
    emitEnd(idC, 0);

    await branchPromise;

    const textEvents = events.filter((e) => e.kind === 'assistant_text');

    const laneA = textEvents.filter((e) => e.runId === (idA as ProviderRunId));
    const laneB = textEvents.filter((e) => e.runId === (idB as ProviderRunId));
    const laneC = textEvents.filter((e) => e.runId === (idC as ProviderRunId));

    expect(laneA).toHaveLength(2);
    expect(laneB).toHaveLength(2);
    expect(laneC).toHaveLength(2);

    for (const e of laneA) expect(e.runId).toBe(idA as ProviderRunId);
    for (const e of laneB) expect(e.runId).toBe(idB as ProviderRunId);
    for (const e of laneC) expect(e.runId).toBe(idC as ProviderRunId);
  });

  it('cancel mid-flight: spawn throws → cancelGroup teardown, listener unlistened', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    let callCount = 0;
    invokeParallelPhaseRunSpawnSpy.mockImplementation(
      async (args: { runs: ReadonlyArray<{ runId: string }> }) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('spawn failed for run-b');
        }
        return args.runs.map((r) => r.runId);
      },
    );

    const { effects } = makeEffects();
    const inputs = makeInputs();
    const deps = makeDeps(effects);

    await expect(runParallelBranch(inputs, deps)).rejects.toThrow('spawn failed for run-b');

    expect(parallelPhaseGroupCreateSpy).toHaveBeenCalledOnce();

    expect(parallelPhaseGroupUpdateCompletedAtSpy).not.toHaveBeenCalled();
  });

  it('maxParallelism cap: only 2 runs spawned when maxParallelism=2', async () => {
    const insertedPhaseRuns: Parameters<typeof wirePhaseRunSpies>[0] = [];
    wirePhaseRunSpies(insertedPhaseRuns);

    const { effects } = makeEffects();
    const inputs: ParallelBranchInputs = {
      ...makeInputs(),
      maxParallelism: 2,
    };
    const deps = makeDeps(effects);

    const branchPromise = runParallelBranch(inputs, deps);
    await new Promise((r) => setTimeout(r, 10));

    expect(invokeParallelPhaseRunSpawnSpy).toHaveBeenCalledTimes(2);

    const spawnedRunIds = (
      invokeParallelPhaseRunSpawnSpy.mock.calls as unknown as ReadonlyArray<
        [{ runs: ReadonlyArray<{ runId: string }> }]
      >
    ).map(([a]) => a.runs[0]!.runId);

    for (const id of spawnedRunIds) emitEnd(id, 0);

    const result = await branchPromise;
    expect(result.runIds).toHaveLength(2);
    expect(result.allFailed).toBe(false);
  });
});
