import type { WorkflowId } from '@goodboy/types';

const userEditedWorkflowTitles = new Set<WorkflowId>();

export const markWorkflowTitleUserEdited = (workflowId: WorkflowId): void => {
  userEditedWorkflowTitles.add(workflowId);
};

export const unmarkWorkflowTitleUserEdited = (workflowId: WorkflowId): void => {
  userEditedWorkflowTitles.delete(workflowId);
};

export const isWorkflowTitleUserEdited = (workflowId: WorkflowId): boolean =>
  userEditedWorkflowTitles.has(workflowId);
