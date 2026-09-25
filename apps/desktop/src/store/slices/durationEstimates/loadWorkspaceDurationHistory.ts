import { ESTIMATE_WINDOW_MS, buildDurationHistory } from '@goodboy/core';
import { listWorkspaceTurnSpans } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadWorkspaceDurationHistoryParams, SetFn } from './types';

export const loadWorkspaceDurationHistory =
  (set: SetFn) =>
  async ({ workspaceId }: LoadWorkspaceDurationHistoryParams): Promise<void> => {
    try {
      const spans = await listWorkspaceTurnSpans({
        db: tauriDatabase,
        workspaceId,
        sinceMs: Date.now() - ESTIMATE_WINDOW_MS,
      });
      const history = buildDurationHistory({ spans });
      set((state) => ({
        workspaceDurationHistory: { ...state.workspaceDurationHistory, [workspaceId]: history },
      }));
    } catch (error) {
      console.error('duration history load failed', error);
    }
  };
