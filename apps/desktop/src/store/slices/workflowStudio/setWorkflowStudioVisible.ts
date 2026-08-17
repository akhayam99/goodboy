import type { SetFn } from './types';
import type { WorkspaceId } from '@goodboy/types';

export type Params = { readonly workspaceId: WorkspaceId | null };

export const setWorkflowStudioVisible = (set: SetFn) => {
  return ({ workspaceId }: Params): void => {
    set({ visibleWorkflowStudioWorkspaceId: workspaceId });
  };
};
