import type { ProviderId } from './provider-registry';
import type { ModelSelection } from './model-catalog';

export type SessionProviderPreference = {
  readonly defaultProvider: ProviderId;
  readonly defaultModel?: string;
  readonly allowTurnOverride: boolean;
  readonly enabledProviders?: ReadonlyArray<ProviderId>;
};

export type TurnProviderOverride = {
  readonly providerId: ProviderId;
  readonly model?: string;
  readonly selection?: ModelSelection;
};

export const DEFAULT_SESSION_PROVIDER_PREFERENCE: SessionProviderPreference = {
  defaultProvider: 'anthropic',
  allowTurnOverride: true,
};
