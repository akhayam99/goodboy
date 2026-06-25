import type { ProviderId } from './provider-registry'

export type SessionProviderPreference = {
  readonly defaultProvider: ProviderId
  readonly defaultModel?: string
  readonly allowTurnOverride: boolean
  readonly enabledProviders?: ReadonlyArray<ProviderId>
}

export type TurnProviderOverride = {
  readonly providerId: ProviderId
  readonly model?: string
}

export const DEFAULT_SESSION_PROVIDER_PREFERENCE: SessionProviderPreference = {
  defaultProvider: 'anthropic',
  allowTurnOverride: true,
}
