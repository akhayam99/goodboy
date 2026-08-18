import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';

export type RunWorkflowKind = 'preset' | 'custom' | 'orchestrator';

type Params = {
  readonly workflow: Workflow;
};

export const runWorkflowKind = ({ workflow }: Params): RunWorkflowKind => {
  if (workflow.origin === 'orchestrated') {
    return 'orchestrator';
  }
  if (workflow.origin === 'library') {
    return 'preset';
  }
  if (workflow.origin === 'custom') {
    return 'custom';
  }
  const name = workflow.name.trim().toLowerCase();
  return WORKFLOW_LIBRARY.some((entry) => entry.name.toLowerCase() === name) ? 'preset' : 'custom';
};
