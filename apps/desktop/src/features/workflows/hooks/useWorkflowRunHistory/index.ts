import { useCallback, useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkflowRunHistoryLoad } from '../../../../store/slices/workflowStudio/types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type WorkflowRunHistory = {
  readonly load: WorkflowRunHistoryLoad | null;
  readonly reload: () => void;
};

export const useWorkflowRunHistory = ({ workspaceId }: Params): WorkflowRunHistory => {
  const load = useAppStore((state) => state.workflowRunHistory[workspaceId] ?? null);
  const loadWorkflowRunHistory = useAppStore((state) => state.loadWorkflowRunHistory);
  const reload = useCallback(() => {
    void loadWorkflowRunHistory({ workspaceId });
  }, [loadWorkflowRunHistory, workspaceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { load, reload };
};
