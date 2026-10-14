import type { ProviderId } from '@goodboy/types';

export const AUTO_CHILD_PROVIDERS = [
  'anthropic',
  'codex',
] as const satisfies ReadonlyArray<ProviderId>;

export const AUTO_OWN_PROVIDERS = ['anthropic'] as const satisfies ReadonlyArray<ProviderId>;

type ProviderParams = {
  readonly provider: string;
};

export const isAutoChildProvider = ({ provider }: ProviderParams): boolean =>
  AUTO_CHILD_PROVIDERS.some((candidate) => candidate === provider);

export const isAutoOwnProvider = ({ provider }: ProviderParams): boolean =>
  AUTO_OWN_PROVIDERS.some((candidate) => candidate === provider);
