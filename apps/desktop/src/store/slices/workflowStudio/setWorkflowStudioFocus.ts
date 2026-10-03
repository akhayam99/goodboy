import type { WorkflowId } from '@goodboy/types';
import type { StudioHomeView } from '../../../features/workflows/studioHomeView';
import type { SetFn } from './types';

export type SetWorkflowStudioFocusParams = {
  readonly workflowId: WorkflowId | null;
};

export const setWorkflowStudioFocus = (set: SetFn) => {
  return ({ workflowId }: SetWorkflowStudioFocusParams): void => {
    set({ workflowStudioFocus: workflowId });
  };
};

export const setWorkflowStudioView = (set: SetFn) => {
  return (view: StudioHomeView): void => {
    set({ workflowStudioView: view });
  };
};
