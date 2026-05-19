import type { ProviderId } from './provider-registry';

export interface SessionProviderPreference {
  readonly defaultProvider: ProviderId;
  readonly defaultModel?: string;
  readonly allowTurnOverride: boolean;
}

export interface TurnProviderOverride {
  readonly providerId: ProviderId;
  readonly model?: string;
}
