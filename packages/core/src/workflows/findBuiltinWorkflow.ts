import type { Workflow } from '@goodboy/types';
import type { WorkflowLibraryEntry } from './library';

type Params = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly entry: WorkflowLibraryEntry;
};

export const findBuiltinWorkflow = ({ workflows, entry }: Params): Workflow | null => {
  const prefix = `wf_seed_${entry.slug}_`;
  return workflows.find((workflow) => workflow.id.startsWith(prefix)) ?? null;
};
