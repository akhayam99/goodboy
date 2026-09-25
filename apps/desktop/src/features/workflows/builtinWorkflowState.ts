import { WORKFLOW_LIBRARY, type WorkflowLibraryEntry } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';

export type BuiltinWorkflowState = 'custom' | 'builtin' | 'edited';

type Params = {
  readonly workflow: Workflow;
};

const SEED_ID_PREFIX = 'wf_seed_';

const libraryEntryOf = ({ workflow }: Params): WorkflowLibraryEntry | null =>
  WORKFLOW_LIBRARY.find((entry) => workflow.id.startsWith(`${SEED_ID_PREFIX}${entry.slug}_`)) ??
  null;

type MatchParams = {
  readonly workflow: Workflow;
  readonly entry: WorkflowLibraryEntry;
};

const matchesEntry = ({ workflow, entry }: MatchParams): boolean => {
  if (workflow.name !== entry.name || workflow.steps.length !== entry.steps.length) {
    return false;
  }
  const steps = [...workflow.steps].sort((left, right) => left.ordinal - right.ordinal);
  return steps.every((step, index) => {
    const base = entry.steps[index];
    return (
      base !== undefined &&
      step.name === base.name &&
      step.role === base.role &&
      (step.promptPrefix ?? '') === base.promptPrefix &&
      (step.expectedOutput ?? '') === base.expectedOutput &&
      (step.providerOverride ?? null) === null &&
      (step.modelOverride ?? null) === null
    );
  });
};

export const builtinWorkflowState = ({ workflow }: Params): BuiltinWorkflowState => {
  if (workflow.origin !== 'library') {
    return 'custom';
  }
  const entry = libraryEntryOf({ workflow });
  if (entry === null) {
    return 'builtin';
  }
  return matchesEntry({ workflow, entry }) ? 'builtin' : 'edited';
};
