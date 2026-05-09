import type { ProviderId } from './provider-registry';

export interface TaskProviderPreference {
  readonly defaultProvider: ProviderId;
  readonly defaultModel?: string;
  readonly allowTurnOverride: boolean;
}

export interface TurnProviderOverride {
  readonly providerId: ProviderId;
  readonly model?: string;
}

export const DEFAULT_TASK_PROVIDER_PREFERENCE: TaskProviderPreference = {
  defaultProvider: 'anthropic',
  allowTurnOverride: true,
};
