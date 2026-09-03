import { isAgentRole } from '@goodboy/core';
import type { PlannerOutput } from '@goodboy/core';
import type { ProviderId, StepDef, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { clampEffort, type EffortLevel } from '../../chat/utils/chat-constants';
import type { WorkflowUpsertArgs } from '../workflows';
import type { StepDraft, WorkflowDraft, WorkflowDraftErrors } from './types';

export type { StepDraft, WorkflowDraft, WorkflowDraftErrors } from './types';

const DEFAULT_EFFORT: EffortLevel = 'medium';

const nextKey = (): string => crypto.randomUUID();

type DraftFromWorkflowParams = { readonly workflow: Workflow };

export const draftFromWorkflow = ({ workflow }: DraftFromWorkflowParams): WorkflowDraft => ({
  name: workflow.name,
  description: workflow.description,
  goal: workflow.goal ?? '',
  origin: workflow.origin ?? 'custom',
  isPreset: workflow.isPreset !== false,
  steps: [...workflow.steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((step) => ({
      key: nextKey(),
      sourceStepId: step.id,
      libraryStepId: step.libraryStepId ?? null,
      role: step.role ?? 'custom',
      name: step.name,
      prompt: step.promptPrefix ?? '',
      expectedOutput: step.expectedOutput ?? '',
      provider: step.providerOverride ?? '',
      model: step.modelOverride ?? '',
      effort: (step.effort as EffortLevel | undefined) ?? DEFAULT_EFFORT,
      verbosity: step.verbosity ?? 'normal',
    })),
});

type DraftFromStepDefParams = { readonly def: StepDef };

export const draftFromStepDef = ({ def }: DraftFromStepDefParams): StepDraft => ({
  key: nextKey(),
  sourceStepId: null,
  libraryStepId: def.id,
  role: def.role,
  name: def.name,
  prompt: def.promptPrefix,
  expectedOutput: '',
  provider: def.providerDefault ?? '',
  model: def.modelDefault ?? '',
  effort: (def.effortDefault as EffortLevel | undefined) ?? DEFAULT_EFFORT,
  verbosity: def.verbosityDefault ?? 'normal',
});

type DraftFromPlannerStepsParams = { readonly steps: PlannerOutput['steps'] };

export const draftFromPlannerSteps = ({ steps }: DraftFromPlannerStepsParams): StepDraft[] =>
  steps.map((step) => ({
    key: nextKey(),
    sourceStepId: null,
    libraryStepId: null,
    role: isAgentRole(step.role) ? step.role : 'custom',
    name: step.name,
    prompt: step.promptPrefix,
    expectedOutput: step.expectedOutput,
    provider: '',
    model: '',
    effort: DEFAULT_EFFORT,
    verbosity: 'normal',
  }));

type UpsertArgsFromDraftParams = {
  readonly draft: WorkflowDraft;
  readonly workspaceId: WorkspaceId;
  readonly id?: WorkflowId;
};

export const upsertArgsFromDraft = ({
  draft,
  workspaceId,
  id,
}: UpsertArgsFromDraftParams): WorkflowUpsertArgs => ({
  ...(id !== undefined && { id }),
  workspaceId,
  name: draft.name.trim(),
  description: draft.description.trim(),
  ...(draft.goal.trim().length > 0 && { goal: draft.goal.trim() }),
  steps: draft.steps.map((step, ordinal) => ({
    ...(step.sourceStepId !== null && { id: step.sourceStepId }),
    ...(step.libraryStepId !== null && { libraryStepId: step.libraryStepId }),
    role: step.role,
    ordinal,
    name: step.name.trim(),
    promptPrefix: step.prompt,
    ...(step.expectedOutput.trim().length > 0 && {
      expectedOutput: step.expectedOutput.trim(),
    }),
    ...(step.provider !== '' && { providerOverride: step.provider }),
    ...(step.model.trim().length > 0 && { modelOverride: step.model.trim() }),
    effort: step.effort,
    verbosity: step.verbosity,
  })),
  isPreset: draft.isPreset,
  origin: draft.origin,
});

type StepDraftWithModelParams = {
  readonly step: StepDraft;
  readonly provider: ProviderId | '';
  readonly model: string;
};

export const stepDraftWithModel = ({
  step,
  provider,
  model,
}: StepDraftWithModelParams): StepDraft => ({
  ...step,
  provider,
  model,
  effort: clampEffort(model, step.effort),
});

type ValidateDraftParams = { readonly draft: WorkflowDraft };

export const validateDraft = ({ draft }: ValidateDraftParams): WorkflowDraftErrors => {
  const stepNames = Object.fromEntries(
    draft.steps
      .filter((step) => step.name.trim().length === 0)
      .map((step) => [step.key, 'Step name is required']),
  );
  return {
    ...(draft.name.trim().length === 0 && { name: 'Name is required' }),
    ...(draft.steps.length === 0 && { steps: 'Add at least one step' }),
    stepNames,
  };
};

type ReorderStepsParams = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly from: number;
  readonly to: number;
};

export const reorderSteps = ({ steps, from, to }: ReorderStepsParams): ReadonlyArray<StepDraft> => {
  if (from < 0 || from >= steps.length || to < 0 || to > steps.length || to === from) {
    return steps;
  }
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return steps;
  }
  next.splice(to > from ? to - 1 : to, 0, moved);
  return next;
};

type AddStepParams = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly step?: StepDraft;
  readonly atIndex?: number;
};

export const addStep = ({
  steps,
  step,
  atIndex = steps.length,
}: AddStepParams): ReadonlyArray<StepDraft> => {
  const next = [...steps];
  next.splice(
    Math.max(0, Math.min(atIndex, next.length)),
    0,
    step ?? {
      key: nextKey(),
      sourceStepId: null,
      libraryStepId: null,
      role: 'custom',
      name: '',
      prompt: '',
      expectedOutput: '',
      provider: '',
      model: '',
      effort: DEFAULT_EFFORT,
      verbosity: 'normal',
    },
  );
  return next;
};

type RemoveStepParams = { readonly steps: ReadonlyArray<StepDraft>; readonly key: string };

export const removeStep = ({ steps, key }: RemoveStepParams): ReadonlyArray<StepDraft> =>
  steps.filter((step) => step.key !== key);

type UpdateStepParams = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly key: string;
  readonly patch: Partial<StepDraft>;
};

export const updateStep = ({ steps, key, patch }: UpdateStepParams): ReadonlyArray<StepDraft> =>
  steps.map((step) => (step.key === key ? { ...step, ...patch } : step));
