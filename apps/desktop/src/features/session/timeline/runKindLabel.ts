import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';

type Params = {
  readonly workflow: Workflow;
};

export const runKindLabel = ({ workflow }: Params): string => {
  if (workflow.origin === 'orchestrated') {
    return 'orchestrator';
  }
  const name = workflow.name.trim().toLowerCase();
  const preset = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === name);
  if (preset != null) {
    return preset.name.toLowerCase();
  }
  return 'workflow';
};
