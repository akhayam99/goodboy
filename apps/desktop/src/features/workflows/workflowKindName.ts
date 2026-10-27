import type { Workflow } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '@goodboy/core';

type WorkflowKindNameParams = {
  readonly workflow: Workflow;
};

export const workflowKindName = ({ workflow }: WorkflowKindNameParams): string => {
  const raw = workflow.name.trim();
  if (raw === '') {
    return 'custom';
  }
  const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  return match === undefined ? raw : match.name;
};
