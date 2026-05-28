import type { AgentStatus, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import { resolveConflicts } from '@goodboy/core';
import type { GetFn, SetFn } from './types';

export function resolveMergeConflicts(set: SetFn, get: GetFn) {
  return async (
    sessionId: SessionId,
    picks: Record<string, string>,
    runStatuses: ReadonlyArray<{ runId: string; completedAt: string; status: string }>,
  ) => {
    const conflicts = get().sessionMergeConflicts[sessionId] ?? [];
    await resolveConflicts({
      conflicts,
      runStatuses: runStatuses.map((rs) => ({
        runId: rs.runId as ProviderRunId,
        completedAt: rs.completedAt as IsoDateTime,
        status: rs.status as AgentStatus,
      })),
      strategy: 'manual',
      manualPicks: picks as Record<string, ProviderRunId>,
    });
    set((state) => {
      const next = { ...state.sessionMergeConflicts };
      delete next[sessionId];
      return { sessionMergeConflicts: next };
    });
  };
}
