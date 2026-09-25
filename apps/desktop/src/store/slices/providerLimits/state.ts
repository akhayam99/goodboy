import type { ProviderId, ProviderLimits } from '@goodboy/types';

export type ProviderLimitsState = {
  readonly providerLimits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
};

export const providerLimitsInitialState: ProviderLimitsState = {
  providerLimits: {},
};
