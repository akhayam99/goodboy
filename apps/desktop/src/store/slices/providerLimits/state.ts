import type { CodexResetCredits, IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';

export type ProviderLimitsProbeStatus = {
  readonly isChecking: boolean;
  readonly checkedAt: IsoDateTime | null;
  readonly failures: number;
};

export type ProviderLimitsState = {
  readonly providerLimits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
  readonly providerLimitsProbe: Readonly<Partial<Record<ProviderId, ProviderLimitsProbeStatus>>>;
  readonly codexResetCredits: CodexResetCredits | null;
};

export const providerLimitsInitialState: ProviderLimitsState = {
  providerLimits: {},
  providerLimitsProbe: {},
  codexResetCredits: null,
};
