import type { ProviderId, ProviderName } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';

type Params = {
  readonly provider: ProviderName;
  readonly model: string;
};

export const contextWindowFor = ({ provider, model }: Params): number | null => {
  const capability = PROVIDER_CAPABILITIES[provider as ProviderId];
  if (capability == null) {
    return null;
  }
  const exact = capability.models.find((candidate) => candidate.id === model);
  if (exact != null) {
    return exact.contextWindow;
  }
  const fallback =
    capability.models.find((candidate) => candidate.tier === 'turn') ?? capability.models[0];
  return fallback?.contextWindow ?? null;
};
