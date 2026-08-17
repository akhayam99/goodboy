import type { SetFn } from './types';
import type { WorkspaceId } from '@goodboy/types';

export type Params = { readonly workspaceId: WorkspaceId };

export const clearWorkflowStudioDraft = (set: SetFn) => {
  return ({ workspaceId }: Params): void => {
    set((state) => {
      if (state.workflowStudioDrafts[workspaceId] === undefined) {
        return {};
      }
      const workflowStudioDrafts = { ...state.workflowStudioDrafts };
      delete workflowStudioDrafts[workspaceId];
      return { workflowStudioDrafts };
    });
  };
};
