import type { TurnFailureKind, TurnFallbackPlan } from '@goodboy/core';
import { modelLabel } from '../../../features/chat/utils/chat-constants';
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
    case 'usage_limit':
      return 'is at its account usage limit';
    case 'unreachable':
      return 'was unreachable';
    case 'model_not_available':
      return 'does not accept this model';
    case 'cli_too_old':
      return 'runs a CLI too old for this model';
    case 'other':
      return 'failed';
    default: {
      const exhaustive: never = failure;
      throw new Error(`unknown turn failure: ${String(exhaustive)}`);
    }
  }
};

export const fallbackNoticeMessage = ({ provider, failure, plan }: Params): string => {
  const label = modelLabel(plan.model, plan.provider);
  return `${provider} ${reasonFor({ failure })}. retrying on ${plan.provider} ${label}.`;
};
