import { listWorkspaceWorkflowRuns } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn, WorkflowRunHistoryLoad } from './types';

export type LoadWorkflowRunHistoryParams = {
  readonly workspaceId: WorkspaceId;
};

type PatchParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
  readonly requestId: number;
  readonly next: (current: WorkflowRunHistoryLoad) => WorkflowRunHistoryLoad;
};

const patchIfLatest = ({ set, get, workspaceId, requestId, next }: PatchParams): void => {
  const current = get().workflowRunHistory[workspaceId];
  if (current === undefined || current.requestId !== requestId) {
    return;
  }
  set((state) => ({
    workflowRunHistory: { ...state.workflowRunHistory, [workspaceId]: next(current) },
  }));
};

export const loadWorkflowRunHistory = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: LoadWorkflowRunHistoryParams): Promise<void> => {
    const previous = get().workflowRunHistory[workspaceId];
    const requestId = (previous?.requestId ?? 0) + 1;
    set((state) => ({
      workflowRunHistory: {
        ...state.workflowRunHistory,
        [workspaceId]: { status: 'loading', runs: previous?.runs ?? null, requestId },
      },
    }));
    try {
      const runs = await listWorkspaceWorkflowRuns({ db: tauriDatabase, workspaceId });
      patchIfLatest({
        set,
        get,
        workspaceId,
        requestId,
        next: () => ({ status: 'ready', runs, requestId }),
      });
    } catch {
      patchIfLatest({
        set,
        get,
        workspaceId,
        requestId,
        next: (current) => ({ status: 'failed', runs: current.runs, requestId }),
      });
    }
  };
};
