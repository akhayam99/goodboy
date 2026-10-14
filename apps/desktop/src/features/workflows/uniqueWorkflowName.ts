import type { Workflow } from '@goodboy/types';

export const ORCHESTRATED_WORKFLOW_NAME = 'Orchestrated workflow';

export const uniqueWorkflowName = (
  requested: string,
  existing: ReadonlyArray<Workflow>,
): string => {
  const names = new Set(existing.filter((t) => !t.deletedAt).map((t) => t.name));
  if (!names.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (names.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};
