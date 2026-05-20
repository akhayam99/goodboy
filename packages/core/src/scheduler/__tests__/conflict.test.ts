import { describe, expect, it, vi } from 'vitest';
import {
  detectConflicts,
  ManualResolutionRequiredError,
  resolveConflicts,
  type FileConflict,
  type RunFileTouches,
} from '../conflict';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';

const runId = (id: string) => id as ProviderRunId;
const iso = (s: string) => s as IsoDateTime;

describe('detectConflicts', () => {
  it('returns empty for disjoint touches', () => {
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: runId('run-a'), files: ['src/foo.ts', 'src/bar.ts'] },
      { runId: runId('run-b'), files: ['src/baz.ts'] },
    ];
    expect(detectConflicts(touches)).toHaveLength(0);
  });

  it('detects single conflict between 2 runs', () => {
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: runId('run-a'), files: ['src/shared.ts'] },
      { runId: runId('run-b'), files: ['src/shared.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.file).toBe('src/shared.ts');
    expect(conflicts[0]!.runIds).toContain(runId('run-a'));
    expect(conflicts[0]!.runIds).toContain(runId('run-b'));
  });

  it('detects N conflicts across multiple files', () => {
    const touches: ReadonlyArray<RunFileTouches> = [
      { runId: runId('run-a'), files: ['a.ts', 'b.ts', 'c.ts'] },
      { runId: runId('run-b'), files: ['a.ts', 'b.ts'] },
      { runId: runId('run-c'), files: ['b.ts', 'd.ts'] },
    ];
    const conflicts = detectConflicts(touches);
    const files = conflicts.map((c) => c.file).sort();
    expect(files).toEqual(['a.ts', 'b.ts']);
    const bConflict = conflicts.find((c) => c.file === 'b.ts')!;
    expect(bConflict.runIds).toHaveLength(3);
  });

  it('returns empty for empty input', () => {
    expect(detectConflicts([])).toHaveLength(0);
  });
});

describe('resolveConflicts — last_write_wins', () => {
  const conflicts: ReadonlyArray<FileConflict> = [
    { file: 'src/shared.ts', runIds: [runId('run-a'), runId('run-b')] },
  ];

  it('picks run with later completedAt', async () => {
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [
        { runId: runId('run-a'), completedAt: iso('2024-01-01T10:00:00Z'), status: 'completed' },
        { runId: runId('run-b'), completedAt: iso('2024-01-01T11:00:00Z'), status: 'completed' },
      ],
      strategy: 'last_write_wins',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.winnerRunId).toBe(runId('run-b'));
    expect(result[0]!.reason).toBe('last_write_wins');
  });

  it('tie in completedAt → picks lower runId (deterministic)', async () => {
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [
        { runId: runId('run-a'), completedAt: iso('2024-01-01T10:00:00Z'), status: 'completed' },
        { runId: runId('run-b'), completedAt: iso('2024-01-01T10:00:00Z'), status: 'completed' },
      ],
      strategy: 'last_write_wins',
    });
    expect(result[0]!.winnerRunId).toBe(runId('run-a'));
  });

  it('skips non-completed runs when picking winner', async () => {
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [
        { runId: runId('run-a'), completedAt: iso('2024-01-01T10:00:00Z'), status: 'failed' },
        { runId: runId('run-b'), completedAt: iso('2024-01-01T09:00:00Z'), status: 'completed' },
      ],
      strategy: 'last_write_wins',
    });
    expect(result[0]!.winnerRunId).toBe(runId('run-b'));
  });

  it('falls back to deterministic runId sort when no run is completed', async () => {
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [
        { runId: runId('run-a'), completedAt: iso('2024-01-01T10:00:00Z'), status: 'failed' },
        { runId: runId('run-b'), completedAt: iso('2024-01-01T11:00:00Z'), status: 'failed' },
      ],
      strategy: 'last_write_wins',
    });
    expect(result[0]!.winnerRunId).toBe(runId('run-a'));
  });

  it('returns empty when no conflicts', async () => {
    const result = await resolveConflicts({
      conflicts: [],
      runStatuses: [],
      strategy: 'last_write_wins',
    });
    expect(result).toHaveLength(0);
  });
});

describe('resolveConflicts — manual', () => {
  const conflicts: ReadonlyArray<FileConflict> = [
    { file: 'src/alpha.ts', runIds: [runId('run-a'), runId('run-b')] },
    { file: 'src/beta.ts', runIds: [runId('run-a'), runId('run-c')] },
  ];

  it('resolves all conflicts when manualPicks complete', async () => {
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [],
      strategy: 'manual',
      manualPicks: {
        'src/alpha.ts': runId('run-a'),
        'src/beta.ts': runId('run-c'),
      },
    });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.file === 'src/alpha.ts')!.winnerRunId).toBe(runId('run-a'));
    expect(result.find((r) => r.file === 'src/beta.ts')!.winnerRunId).toBe(runId('run-c'));
    expect(result[0]!.reason).toBe('manual_pick');
  });

  it('throws ManualResolutionRequiredError for missing picks', async () => {
    await expect(
      resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'manual',
        manualPicks: { 'src/alpha.ts': runId('run-a') },
      }),
    ).rejects.toThrow(ManualResolutionRequiredError);
  });

  it('ManualResolutionRequiredError includes unresolved file list', async () => {
    try {
      await resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'manual',
        manualPicks: {},
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ManualResolutionRequiredError);
      const e = err as ManualResolutionRequiredError;
      expect(e.unresolvedFiles).toContain('src/alpha.ts');
      expect(e.unresolvedFiles).toContain('src/beta.ts');
    }
  });

  it('throws when manualPicks is absent', async () => {
    await expect(
      resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'manual',
      }),
    ).rejects.toThrow(ManualResolutionRequiredError);
  });
});

describe('resolveConflicts — synthesizer_driven', () => {
  const conflicts: ReadonlyArray<FileConflict> = [
    { file: 'src/shared.ts', runIds: [runId('run-a'), runId('run-b')] },
  ];

  it('calls synthesize per conflict and returns result', async () => {
    const synthesize = vi.fn().mockResolvedValue(runId('run-b'));
    const result = await resolveConflicts({
      conflicts,
      runStatuses: [],
      strategy: 'synthesizer_driven',
      synthesize,
    });
    expect(synthesize).toHaveBeenCalledOnce();
    expect(synthesize).toHaveBeenCalledWith(conflicts[0]);
    expect(result[0]!.winnerRunId).toBe(runId('run-b'));
    expect(result[0]!.reason).toBe('synthesizer');
  });

  it('surfaces error when synthesize rejects', async () => {
    const synthesize = vi.fn().mockRejectedValue(new Error('provider unavailable'));
    await expect(
      resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'synthesizer_driven',
        synthesize,
      }),
    ).rejects.toThrow('provider unavailable');
  });

  it('throws when synthesize callback is absent', async () => {
    await expect(
      resolveConflicts({
        conflicts,
        runStatuses: [],
        strategy: 'synthesizer_driven',
      }),
    ).rejects.toThrow('synthesizer_driven strategy requires a synthesize callback');
  });
});
