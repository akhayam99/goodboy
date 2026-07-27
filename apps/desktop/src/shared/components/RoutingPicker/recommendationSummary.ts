import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { PROVIDER_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
};

export const recommendationSummary = ({ provider, model }: Params): string => {
  const label = PROVIDER_LABEL[provider];
  if (model == null) {
    return label;
  }
  if (!PROVIDER_CAPABILITIES[provider].models.some((entry) => entry.id === model)) {
    return label;
  }
  return `${label} · ${modelLabel(model)}`;
};
