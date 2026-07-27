import type { ProviderId } from './provider-registry';

export type ProviderKind = 'cli' | 'api';

export type OpenCodeRouting = {
  readonly slug: string;
};

export const PROVIDER_KIND = {
  anthropic: 'cli',
  cursor: 'cli',
  codex: 'cli',
  gemini: 'cli',
  opencode: 'cli',
  openrouter: 'api',
} satisfies Readonly<Record<ProviderId, ProviderKind>>;

export const OPENCODE_ROUTING: Readonly<Partial<Record<ProviderId, OpenCodeRouting>>> = {
  openrouter: { slug: 'openrouter' },
};

export const PROVIDER_BETA: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'opencode',
  'openrouter',
]);

type ProviderParams = {
  readonly id: ProviderId;
};

type ModelParams = ProviderParams & {
  readonly model: string;
};

export const isApiProvider = ({ id }: ProviderParams): boolean => {
  return PROVIDER_KIND[id] === 'api';
};

export const opencodeModelArg = ({ id, model }: ModelParams): string => {
  const routing = OPENCODE_ROUTING[id];
  if (routing === undefined || model.includes('/')) {
    return model;
  }
  return `${routing.slug}/${model}`;
};
