import type {
  IsoDateTime,
  ParallelMergeStrategy,
  SessionStatus,
  ProviderRunId,
} from '@kay-am/types';

export interface RunFileTouches {
  runId: ProviderRunId;
  files: ReadonlyArray<string>;
}

export interface FileConflict {
  file: string;
  runIds: ReadonlyArray<ProviderRunId>;
}

export interface ResolvedConflict {
  file: string;
  winnerRunId: ProviderRunId;
  reason: 'last_write_wins' | 'manual_pick' | 'synthesizer';
}

export interface ConflictResolutionInput {
  conflicts: ReadonlyArray<FileConflict>;
  runStatuses: ReadonlyArray<{
    runId: ProviderRunId;
    completedAt: IsoDateTime;
    status: SessionStatus;
  }>;
  strategy: ParallelMergeStrategy;
  manualPicks?: Record<string, ProviderRunId>;
  synthesize?: (conflict: FileConflict) => Promise<ProviderRunId>;
}

export class ManualResolutionRequiredError extends Error {
  readonly unresolvedFiles: ReadonlyArray<string>;

  constructor(unresolvedFiles: ReadonlyArray<string>) {
    super(`manual resolution required for files: ${unresolvedFiles.join(', ')}`);
    this.name = 'ManualResolutionRequiredError';
    this.unresolvedFiles = unresolvedFiles;
  }
}

export function detectConflicts(
  touches: ReadonlyArray<RunFileTouches>,
): ReadonlyArray<FileConflict> {
  const fileToRuns = new Map<string, ProviderRunId[]>();

  for (const { runId, files } of touches) {
    for (const file of files) {
      const existing = fileToRuns.get(file);
      if (existing === undefined) {
        fileToRuns.set(file, [runId]);
      } else {
        existing.push(runId);
      }
    }
  }

  const conflicts: FileConflict[] = [];
  for (const [file, runIds] of fileToRuns) {
    if (runIds.length >= 2) {
      conflicts.push({ file, runIds });
    }
  }

  return conflicts;
}

export async function resolveConflicts(
  input: ConflictResolutionInput,
): Promise<ReadonlyArray<ResolvedConflict>> {
  const { conflicts, runStatuses, strategy, manualPicks, synthesize } = input;

  if (conflicts.length === 0) {
    return [];
  }

  if (strategy === 'last_write_wins') {
    return resolveLastWriteWins(conflicts, runStatuses);
  }

  if (strategy === 'manual') {
    return resolveManual(conflicts, manualPicks ?? {});
  }

  return resolveSynthesizer(conflicts, synthesize);
}

function resolveLastWriteWins(
  conflicts: ReadonlyArray<FileConflict>,
  runStatuses: ReadonlyArray<{
    runId: ProviderRunId;
    completedAt: IsoDateTime;
    status: SessionStatus;
  }>,
): ReadonlyArray<ResolvedConflict> {
  const statusMap = new Map(runStatuses.map((r) => [r.runId, r]));

  return conflicts.map((conflict) => {
    const candidates = conflict.runIds
      .map((runId) => statusMap.get(runId))
      .filter(
        (r): r is { runId: ProviderRunId; completedAt: IsoDateTime; status: SessionStatus } =>
          r !== undefined && r.status === 'completed',
      );

    if (candidates.length === 0) {
      // No completed run — fall back to deterministic sort on runId
      const sorted = [...conflict.runIds].sort();
      return { file: conflict.file, winnerRunId: sorted[0]!, reason: 'last_write_wins' };
    }

    // Sort descending by completedAt, tie-break ascending by runId (deterministic)
    candidates.sort((a, b) => {
      const timeDiff = b.completedAt.localeCompare(a.completedAt);
      if (timeDiff !== 0) return timeDiff;
      return a.runId.localeCompare(b.runId);
    });

    return { file: conflict.file, winnerRunId: candidates[0]!.runId, reason: 'last_write_wins' };
  });
}

function resolveManual(
  conflicts: ReadonlyArray<FileConflict>,
  manualPicks: Record<string, ProviderRunId>,
): ReadonlyArray<ResolvedConflict> {
  const unresolved: string[] = [];
  const resolved: ResolvedConflict[] = [];

  for (const conflict of conflicts) {
    const pick = manualPicks[conflict.file];
    if (pick === undefined) {
      unresolved.push(conflict.file);
    } else {
      resolved.push({ file: conflict.file, winnerRunId: pick, reason: 'manual_pick' });
    }
  }

  if (unresolved.length > 0) {
    throw new ManualResolutionRequiredError(unresolved);
  }

  return resolved;
}

async function resolveSynthesizer(
  conflicts: ReadonlyArray<FileConflict>,
  synthesize: ((conflict: FileConflict) => Promise<ProviderRunId>) | undefined,
): Promise<ReadonlyArray<ResolvedConflict>> {
  if (synthesize === undefined) {
    throw new Error('synthesizer_driven strategy requires a synthesize callback');
  }

  return Promise.all(
    conflicts.map(async (conflict) => {
      const winnerRunId = await synthesize(conflict);
      return { file: conflict.file, winnerRunId, reason: 'synthesizer' as const };
    }),
  );
}
