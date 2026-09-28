import type { WorkflowId } from '@goodboy/types';
import type { SetFn } from './types';

export type SetWorkflowStudioFocusParams = {
  readonly workflowId: WorkflowId | null;
};

export const setWorkflowStudioFocus = (set: SetFn) => {
  return ({ workflowId }: SetWorkflowStudioFocusParams): void => {
    set({ workflowStudioFocus: workflowId });
  };
};
