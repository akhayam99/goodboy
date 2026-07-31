import { getModelDescriptor, type TurnFailureKind, type TurnFallbackPlan } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly failure: TurnFailureKind;
  readonly plan: TurnFallbackPlan;
};

const reasonFor = ({ failure }: { readonly failure: TurnFailureKind }): string => {
  switch (failure) {
    case 'authentication':
      return 'rejected the credentials';
    case 'rate_limit':
      return 'hit a usage limit';
    case 'unreachable':
      return 'was unreachable';
    case 'model_not_available':
      return 'does not accept this model';
    case 'other':
      return 'failed';
    default: {
      const exhaustive: never = failure;
      throw new Error(`unknown turn failure: ${String(exhaustive)}`);
    }
  }
};

export const fallbackNoticeMessage = ({ provider, failure, plan }: Params): string => {
  const label = getModelDescriptor(plan.model)?.label ?? plan.model;
  return `${provider} ${reasonFor({ failure })}. retrying on ${plan.provider} ${label}.`;
};
