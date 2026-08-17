import type { SetFn, WorkflowStudioDraft } from './types';
import type { WorkspaceId } from '@goodboy/types';

export type Params = {
  readonly workspaceId: WorkspaceId;
  readonly draft: WorkflowStudioDraft;
};

export const setWorkflowStudioDraft = (set: SetFn) => {
  return ({ workspaceId, draft }: Params): void => {
    set((state) => ({
      workflowStudioDrafts: { ...state.workflowStudioDrafts, [workspaceId]: draft },
    }));
  };
};
