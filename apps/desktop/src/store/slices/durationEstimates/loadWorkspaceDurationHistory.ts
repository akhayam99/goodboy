import type { WorkspaceId } from '@goodboy/types';
import { ESTIMATE_WINDOW_MS, buildDurationHistory } from '@goodboy/core';
import { listTurnSpans, listWorkspaceTurnSpans } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadWorkspaceDurationHistoryParams, SetFn } from './types';

export const loadWorkspaceDurationHistory = (set: SetFn) => {
  const latestRequest = new Map<WorkspaceId, number>();
  let requestCount = 0;
  return async ({ workspaceId }: LoadWorkspaceDurationHistoryParams): Promise<void> => {
    requestCount += 1;
    const request = requestCount;
    latestRequest.set(workspaceId, request);
    try {
      const sinceMs = Date.now() - ESTIMATE_WINDOW_MS;
      const [spans, everyWorkspaceSpans] = await Promise.all([
        listWorkspaceTurnSpans({ db: tauriDatabase, workspaceId, sinceMs }),
        listTurnSpans({ db: tauriDatabase, sinceMs }),
      ]);
      const history = buildDurationHistory({ spans, everyWorkspaceSpans });
      if (latestRequest.get(workspaceId) !== request) {
        return;
      }
      set((state) => ({
        workspaceDurationHistory: { ...state.workspaceDurationHistory, [workspaceId]: history },
      }));
    } catch (error) {
      console.error('duration history load failed', error);
    }
  };
};
