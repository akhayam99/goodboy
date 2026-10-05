import type { GetFn } from './types';
import type { WorkspaceId } from '@goodboy/types';

export type Params = { readonly workspaceId: WorkspaceId };

export const undoWorkflowGeneration = (get: GetFn) => {
  return async ({ workspaceId }: Params): Promise<void> => {
    const generation = get().workflowGenerations[workspaceId];
    if (generation?.status !== 'complete' || generation.undoSnapshot === null) {
      return;
    }
    await get().restoreWorkflowSnapshot({ workspaceId, snapshot: generation.undoSnapshot });
    get().consumeWorkflowGeneration({ workspaceId });
  };
};
