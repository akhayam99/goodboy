import type { Workflow } from '@goodboy/types';

export const ORCHESTRATED_WORKFLOW_NAME = 'Orchestrated workflow';

type UniqueWorkflowNameParams = {
  readonly requested: string;
  readonly existing: ReadonlyArray<Workflow>;
};

export const uniqueWorkflowName = ({ requested, existing }: UniqueWorkflowNameParams): string => {
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
