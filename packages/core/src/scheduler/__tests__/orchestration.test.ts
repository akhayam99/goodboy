import { describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  ParallelGroup,
  ParallelGroupId,
  ParallelAgent,
  ParallelAgentId,
  StepId,
  AgentStatus,
  ProviderRunId,
} from '@goodboy/types';
import {
  awaitMerge,
  cancelGroup,
  detectConflicts,
  fanOut,
  ManualResolutionRequiredError,
  resolveConflicts,
  type RunFileTouches,
  type SchedulerDeps,
} from '../index';

const rid = (id: string) => id as ProviderRunId;
const iso = (s: string) => s as IsoDateTime;

function makeGroup(overrides?: Partial<ParallelGroup>): ParallelGroup {
  return {
    id: 'g1' as ParallelGroupId,
    sessionId: 's1' as ParallelGroup['sessionId'],
    ordinal: 1,
    mergeStrategy: 'last_write_wins',
    createdAt: iso('2025-01-01T00:00:00.000Z'),
    completedAt: null,
    ...overrides,
  };
}

function makeRun(index: number, runId: string = `run-${index}`): ParallelAgent {
  return {
    id: `pr-${index}` as ParallelAgentId,
    groupId: 'g1' as ParallelGroupId,
    stepId: `pd-${index}` as StepId,
    parallelIndex: index,
    runId: rid(runId),
    status: 'pending' as AgentStatus,
    worktreePath: `/tmp/wt-${index}`,
    outputSummary: null,
    startedAt: iso('2025-01-01T00:00:00.000Z'),
    completedAt: null,
  };
}

describe('orchestration — happy path: 3 runs, no conflict, last_write_wins', () => {
  it('fan-out completes, merge has 3 success statuses, detectConflicts returns 0', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b'), makeRun(2, 'run-c')];
    const group = makeGroup({ mergeStrategy: 'last_write_wins' });

    const spawnRun = vi.fn(async (run: ParallelAgent) => ({
      status: 'completed' as AgentStatus,
      outputSummary: `output-${run.runId}`,
    }));

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() };
    const handle = fanOut(deps, group, runs);
    const result = await awaitMerge(handle);

    expect(result.groupId).toBe('g1');
    expect(result.mergeStrategy).toBe('last_write_wins');
    expect(result.runStatuses).toHaveLength(3);
    expect(result.runStatuses.every((r) => r.status === 'completed')).toBe(true);

    // per-runId outputSummary preserved
    expect(result.runStatuses.find((r) => r.runId === rid('run-a'))?.outputSummary).toBe(
      'output-run-a',
    );
    expect(result.runStatuses.find((r) => r.runId === rid('run-b'))?.outputSummary).toBe(
      'output-run-b',
    );
    expect(result.runStatuses.find((r) => r.runId === rid('run-c'))?.outputSummary).toBe(
      'output-run-c',
    );

    // disjoint touches → 0 conflicts
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: rid('run-a'), files: ['src/a.ts'] },
      { runId: rid('run-b'), files: ['src/b.ts'] },
      { runId: rid('run-c'), files: ['src/c.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    expect(conflicts).toHaveLength(0);

    // resolveConflicts with empty conflict list → empty resolutions
    const resolutions = await resolveConflicts({
      conflicts,
      runStatuses: [],
      strategy: 'last_write_wins',
    });
    expect(resolutions).toHaveLength(0);
  });
});

describe('orchestration — 1 run fails, 2 complete', () => {
  it('MergeResult includes failure; resolveConflicts only considers completed runs', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b'), makeRun(2, 'run-c')];
    const group = makeGroup({ mergeStrategy: 'last_write_wins' });

    const spawnRun = vi.fn(async (run: ParallelAgent) => {
      if (run.runId === rid('run-b')) {
        return { status: 'failed' as AgentStatus, outputSummary: null, error: 'oom' };
      }
      return { status: 'completed' as AgentStatus, outputSummary: `ok-${run.runId}` };
    });

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() };
    const handle = fanOut(deps, group, runs);
    const result = await awaitMerge(handle);

    expect(result.runStatuses).toHaveLength(3);

    const failed = result.runStatuses.find((r) => r.runId === rid('run-b'));
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('oom');

    const completed = result.runStatuses.filter((r) => r.status === 'completed');
    expect(completed).toHaveLength(2);

    // conflict resolution only uses completed runs
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: rid('run-a'), files: ['src/shared.ts'] },
      { runId: rid('run-c'), files: ['src/shared.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    expect(conflicts).toHaveLength(1);

    // only completed run statuses passed in
    const completedStatuses = result.runStatuses
      .filter((r) => r.status === 'completed')
      .map((r) => ({
        runId: r.runId,
        completedAt: iso('2025-01-01T10:00:00.000Z'),
        status: r.status,
      }));

    const resolutions = await resolveConflicts({
      conflicts,
      runStatuses: completedStatuses,
      strategy: 'last_write_wins',
    });
    expect(resolutions).toHaveLength(1);
    expect([rid('run-a'), rid('run-c')]).toContain(resolutions[0]!.winnerRunId);
    expect(resolutions[0]!.reason).toBe('last_write_wins');
  });
});

describe('orchestration — all 3 runs fail', () => {
  it('MergeResult has 3 failures; resolveConflicts with no completed returns empty', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b'), makeRun(2, 'run-c')];
    const group = makeGroup({ mergeStrategy: 'last_write_wins' });

    const spawnRun = vi.fn(async () => ({
      status: 'failed' as AgentStatus,
      outputSummary: null,
      error: 'crash',
    }));

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() };
    const handle = fanOut(deps, group, runs);
    const result = await awaitMerge(handle);

    expect(result.runStatuses).toHaveLength(3);
    expect(result.runStatuses.every((r) => r.status === 'failed')).toBe(true);
    expect(result.runStatuses.every((r) => r.error === 'crash')).toBe(true);

    // no completed runs → pass empty conflicts + empty statuses
    const resolutions = await resolveConflicts({
      conflicts: [],
      runStatuses: [],
      strategy: 'last_write_wins',
    });
    expect(resolutions).toHaveLength(0);
  });
});

describe('orchestration — conflict detected, last_write_wins', () => {
  it('picks later completedAt; deterministic tie-break via runId', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b'), makeRun(2, 'run-c')];
    const group = makeGroup({ mergeStrategy: 'last_write_wins' });

    const spawnRun = vi.fn(async () => ({
      status: 'completed' as AgentStatus,
      outputSummary: null,
    }));

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() };
    const handle = fanOut(deps, group, runs);
    const result = await awaitMerge(handle);

    expect(result.runStatuses.every((r) => r.status === 'completed')).toBe(true);

    // run-a and run-b both touch src/foo.ts; run-c is disjoint
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: rid('run-a'), files: ['src/foo.ts', 'src/a.ts'] },
      { runId: rid('run-b'), files: ['src/foo.ts', 'src/b.ts'] },
      { runId: rid('run-c'), files: ['src/c.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.file).toBe('src/foo.ts');

    // run-b completed later → wins
    const runStatuses = [
      {
        runId: rid('run-a'),
        completedAt: iso('2025-01-01T10:00:00.000Z'),
        status: 'completed' as AgentStatus,
      },
      {
        runId: rid('run-b'),
        completedAt: iso('2025-01-01T11:00:00.000Z'),
        status: 'completed' as AgentStatus,
      },
      {
        runId: rid('run-c'),
        completedAt: iso('2025-01-01T09:00:00.000Z'),
        status: 'completed' as AgentStatus,
      },
    ];

    const resolutions = await resolveConflicts({
      conflicts,
      runStatuses,
      strategy: 'last_write_wins',
    });
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0]!.winnerRunId).toBe(rid('run-b'));
    expect(resolutions[0]!.reason).toBe('last_write_wins');

    // tie-break test: same completedAt → lower runId wins (run-a < run-b)
    const tieStatuses = [
      {
        runId: rid('run-a'),
        completedAt: iso('2025-01-01T10:00:00.000Z'),
        status: 'completed' as AgentStatus,
      },
      {
        runId: rid('run-b'),
        completedAt: iso('2025-01-01T10:00:00.000Z'),
        status: 'completed' as AgentStatus,
      },
    ];
    const tieResolutions = await resolveConflicts({
      conflicts,
      runStatuses: tieStatuses,
      strategy: 'last_write_wins',
    });
    expect(tieResolutions[0]!.winnerRunId).toBe(rid('run-a'));
  });
});

describe('orchestration — manual strategy, missing pick throws ManualResolutionRequiredError', () => {
  it('throws with the conflicted file in unresolvedFiles when no manualPicks provided', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b')];
    const group = makeGroup({ mergeStrategy: 'manual' });

    const spawnRun = vi.fn(async () => ({
      status: 'completed' as AgentStatus,
      outputSummary: null,
    }));

    const deps: SchedulerDeps = { spawnRun, cancelRun: vi.fn() };
    const handle = fanOut(deps, group, runs);
    await awaitMerge(handle);

    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: rid('run-a'), files: ['src/conflict.ts'] },
      { runId: rid('run-b'), files: ['src/conflict.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    expect(conflicts).toHaveLength(1);

    // no manualPicks → must throw
    await expect(
      resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'manual',
        // no manualPicks
      }),
    ).rejects.toThrow(ManualResolutionRequiredError);

    try {
      await resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'manual',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ManualResolutionRequiredError);
      const e = err as ManualResolutionRequiredError;
      expect(e.unresolvedFiles).toContain('src/conflict.ts');
    }
  });
});

describe('orchestration — cancel mid-flight', () => {
  it('cancelGroup calls cancelRun for all 3 runIds; awaitMerge still resolves', async () => {
    const runs = [makeRun(0, 'run-a'), makeRun(1, 'run-b'), makeRun(2, 'run-c')];
    const group = makeGroup();

    // latches: spawnRun resolves only after we release each latch
    type Latch = { resolve: (v: { status: AgentStatus; outputSummary: null }) => void };
    const latches: Latch[] = [];

    const spawnRun = vi.fn(
      () =>
        new Promise<{ status: AgentStatus; outputSummary: null }>((resolve) => {
          latches.push({ resolve });
        }),
    );

    const cancelRun = vi.fn(async () => undefined);
    const deps: SchedulerDeps = { spawnRun, cancelRun };
    const handle = fanOut(deps, group, runs);

    // wait until all 3 spawnRun calls have been initiated
    await vi.waitFor(() => expect(spawnRun).toHaveBeenCalledTimes(3));

    // cancel before any resolve
    await cancelGroup(handle);

    expect(cancelRun).toHaveBeenCalledTimes(3);
    expect(cancelRun).toHaveBeenCalledWith(rid('run-a'));
    expect(cancelRun).toHaveBeenCalledWith(rid('run-b'));
    expect(cancelRun).toHaveBeenCalledWith(rid('run-c'));

    // release latches so awaitMerge can settle (simulating cancelled runs resolving as failed)
    for (const latch of latches) {
      latch.resolve({ status: 'failed' as AgentStatus, outputSummary: null });
    }

    const result = await awaitMerge(handle);
    expect(result.runStatuses).toHaveLength(3);
    expect(result.runStatuses.every((r) => r.status === 'failed')).toBe(true);
  });
});
