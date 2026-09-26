import type { ProviderId } from './provider-registry';

export type ProviderConnectTier = 'one-click' | 'assisted' | 'manual';

export type ProviderBrowserOwner = 'cli' | 'goodboy' | 'none';

export type ProviderConnectCapability = {
  readonly tier: ProviderConnectTier;
  readonly browserOwner: ProviderBrowserOwner;
  readonly reauthSignsOut: boolean;
  readonly loginEnv: Readonly<Record<string, string>>;
  readonly manualReason: string | null;
};
