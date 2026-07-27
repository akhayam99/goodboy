import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from '@goodboy/core';
import { PROVIDER_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
};

export const recommendationSummary = ({ provider, model }: Params): string => {
  const resolved =
    model != null && PROVIDER_CAPABILITIES[provider].models.some((entry) => entry.id === model)
      ? model
      : getDefaultTurnModel(provider);
  return `${PROVIDER_LABEL[provider]} · ${modelLabel(resolved)}`;
};
