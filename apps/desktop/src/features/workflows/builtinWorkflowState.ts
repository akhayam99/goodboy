import { WORKFLOW_LIBRARY, findBuiltinWorkflow, type WorkflowLibraryEntry } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';

export type BuiltinWorkflowState = 'custom' | 'builtin' | 'edited';

type Params = {
  readonly workflow: Workflow;
};

const libraryEntryOf = ({ workflow }: Params): WorkflowLibraryEntry | null =>
  WORKFLOW_LIBRARY.find(
    (entry) => findBuiltinWorkflow({ workflows: [workflow], entry }) !== null,
  ) ?? null;

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

type BuiltinDrift = 'edited' | 'deleted';

export type RestorableBuiltin = {
  readonly entry: WorkflowLibraryEntry;
  readonly drift: BuiltinDrift;
};

type WorkflowsParams = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly removedIds: ReadonlySet<string>;
};

export const restorableBuiltins = ({
  workflows,
  removedIds,
}: WorkflowsParams): RestorableBuiltin[] =>
  WORKFLOW_LIBRARY.flatMap((entry): RestorableBuiltin[] => {
    const prefix = `wf_seed_${entry.slug}_`;
    const seeded = findBuiltinWorkflow({ workflows, entry }) ?? undefined;
    if (seeded !== undefined && matchesEntry({ workflow: seeded, entry })) {
      return [];
    }
    if (seeded === undefined && ![...removedIds].some((id) => id.startsWith(prefix))) {
      return [];
    }
    return [{ entry, drift: seeded === undefined ? 'deleted' : 'edited' }];
  });

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
