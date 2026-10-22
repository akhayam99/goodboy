import type { PlanChangeRequest, WorkflowRules } from '@goodboy/types';

export type PlanChangeVerdict = 'apply' | 'ask' | 'pinned';

type SameParams = {
  readonly first: PlanChangeRequest;
  readonly second: PlanChangeRequest;
};

const isSamePlanChange = ({ first, second }: SameParams): boolean =>
  first.kind === second.kind &&
  first.step.trim().toLowerCase() === second.step.trim().toLowerCase();

type Params = {
  readonly rules: WorkflowRules | undefined;
  readonly change: PlanChangeRequest;
};

export const planChangeVerdictOf = ({ rules, change }: Params): PlanChangeVerdict => {
  const preset = rules?.preset;
  if (preset === undefined) {
    return 'apply';
  }
  const name = change.step.trim().toLowerCase();
  const target = preset.steps.find((step) => step.name.trim().toLowerCase() === name);
  if (change.kind !== 'added' && target?.isPinned === true) {
    return 'pinned';
  }
  const approved = rules?.approvedChange;
  if (approved !== undefined && isSamePlanChange({ first: approved, second: change })) {
    return 'apply';
  }
  return (rules?.route?.closeness ?? 'follow') === 'adapt' ? 'apply' : 'ask';
};
