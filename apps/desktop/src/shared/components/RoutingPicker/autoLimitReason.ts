import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { AUTO_RECOMMENDATION_COPY } from './autoRecommendationCopy';

type Params = {
  readonly defaultProvider: ProviderId;
  readonly pickedProvider: ProviderId;
  readonly atLimit: ReadonlyArray<ProviderId>;
};

export const autoLimitReason = ({ defaultProvider, pickedProvider, atLimit }: Params): string => {
  if (pickedProvider === defaultProvider || !atLimit.includes(defaultProvider)) {
    return AUTO_RECOMMENDATION_COPY.reason;
  }
  return `${PROVIDER_LABEL[defaultProvider]} is at its usage limit, so Auto picks ${PROVIDER_LABEL[pickedProvider]} until it resets.`;
};
