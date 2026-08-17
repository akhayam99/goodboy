import type { SetFn } from './types';
import type { WorkspaceId } from '@goodboy/types';

export type Params = { readonly workspaceId: WorkspaceId };

export const consumeWorkflowGeneration = (set: SetFn) => {
  return ({ workspaceId }: Params): void => {
    set((state) => ({
      workflowGenerations: { ...state.workflowGenerations, [workspaceId]: { status: 'idle' } },
    }));
  };
};
