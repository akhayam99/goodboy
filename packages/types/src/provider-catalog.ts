import type { ProviderId } from './provider-registry';

export type ProviderKind = 'cli' | 'api';

export type OpenCodeRouting = {
  readonly slug: string;
};
