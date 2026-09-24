import type { ProviderId } from './provider-registry';

export type ProviderConnectTier = 'one-click' | 'assisted' | 'manual';

export type ProviderConnectCapability = {
  readonly tier: ProviderConnectTier;
  readonly hasAuthProbe: boolean;
  readonly opensBrowser: boolean;
  readonly loginEnv: Readonly<Record<string, string>>;
  readonly manualReason: string | null;
};
