import type { Workflow } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '@goodboy/core';

export const workflowKindName = (workflow: Workflow): string => {
  const raw = workflow.name.trim();
  if (!raw) {
    return 'custom';
  }
  const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  return match ? match.name.toLowerCase() : raw;
};
