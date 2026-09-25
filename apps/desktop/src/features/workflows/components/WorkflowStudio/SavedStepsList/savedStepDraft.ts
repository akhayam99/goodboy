import { blankStepDraft, type StepDraft } from '../../../engine';
import { stepDraftFromSavedStep, type SavedStep } from '../../../savedSteps';

export type SavedStepTarget =
  { readonly kind: 'new' } | { readonly kind: 'saved'; readonly step: SavedStep };

export type ExpandedSavedStep = {
  readonly target: SavedStepTarget;
  readonly initial: StepDraft;
  readonly draft: StepDraft;
};

type OpenParams = {
  readonly target: SavedStepTarget;
};

export const openSavedStep = ({ target }: OpenParams): ExpandedSavedStep => {
  const initial =
    target.kind === 'new' ? blankStepDraft() : stepDraftFromSavedStep({ step: target.step });
  return { target, initial, draft: initial };
};

type DirtyParams = {
  readonly expanded: ExpandedSavedStep;
};

const EDITABLE_FIELDS = [
  'role',
  'name',
  'prompt',
  'expectedOutput',
  'provider',
  'model',
  'effort',
  'verbosity',
] as const satisfies ReadonlyArray<keyof StepDraft>;

export const isSavedStepDirty = ({ expanded }: DirtyParams): boolean =>
  EDITABLE_FIELDS.some((field) => expanded.draft[field] !== expanded.initial[field]);
