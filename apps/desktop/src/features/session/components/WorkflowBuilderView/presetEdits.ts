import type { AgentRole, EffortLevel, Step, Workflow } from '@goodboy/types';
import type { StepDraft } from '../../../workflows/engine';

const sortedPresetSteps = (preset: Workflow): Workflow['steps'] =>
  [...preset.steps].sort((first, second) => first.ordinal - second.ordinal);

type SameParams = {
  readonly draft: StepDraft;
  readonly base: Step;
};

const matchesBaseStep = ({ draft, base }: SameParams): boolean =>
  draft.sourceStepId === base.id &&
  draft.name === base.name &&
  draft.prompt === (base.promptPrefix ?? '') &&
  draft.expectedOutput === (base.expectedOutput ?? '') &&
  draft.role === ((base.role ?? 'custom') as AgentRole) &&
  (draft.provider || undefined) === (base.providerOverride ?? undefined) &&
  (draft.model || undefined) === (base.modelOverride ?? undefined) &&
  draft.effort === ((base.effort as EffortLevel | undefined) ?? 'medium');

type PresetParams = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly preset: Workflow;
};

export const stepsMatchPreset = ({ steps, preset }: PresetParams): boolean => {
  const base = sortedPresetSteps(preset);
  if (base.length !== steps.length) {
    return false;
  }
  return steps.every((draft, index) => {
    const step = base[index];
    return step !== undefined && matchesBaseStep({ draft, base: step });
  });
};

export const editedStepKeys = ({ steps, preset }: PresetParams): ReadonlySet<string> => {
  const baseById = new Map(preset.steps.map((step) => [step.id, step]));
  const edited = new Set<string>();
  for (const draft of steps) {
    const base = draft.sourceStepId === null ? undefined : baseById.get(draft.sourceStepId);
    if (base === undefined || !matchesBaseStep({ draft, base })) {
      edited.add(draft.key);
    }
  }
  return edited;
};
