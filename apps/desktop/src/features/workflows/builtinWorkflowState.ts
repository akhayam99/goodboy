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

export type BuiltinDrift = 'edited' | 'deleted';

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
    const prefix = `${SEED_ID_PREFIX}${entry.slug}_`;
    const seeded = workflows.find((workflow) => workflow.id.startsWith(prefix));
    if (seeded !== undefined && matchesEntry({ workflow: seeded, entry })) {
      return [];
    }
    if (seeded === undefined && ![...removedIds].some((id) => id.startsWith(prefix))) {
      return [];
    }
    const nameTaken = workflows.some(
      (workflow) => workflow.id !== seeded?.id && workflow.name === entry.name,
    );
    if (nameTaken) {
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
