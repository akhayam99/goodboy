import type { ProviderId } from '@goodboy/types';

type PoolParams = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly pool: ReadonlyArray<ProviderId> | null;
};

type ToggleParams = PoolParams & {
  readonly provider: ProviderId;
};

export const effectiveProviderPool = ({
  providers,
  pool,
}: PoolParams): ReadonlyArray<ProviderId> | null => {
  if (pool === null) {
    return null;
  }
  const kept = providers.filter((provider) => pool.includes(provider));
  return kept.length === 0 || kept.length === providers.length ? null : kept;
};

export const toggledProviderPool = ({
  providers,
  pool,
  provider,
}: ToggleParams): ReadonlyArray<ProviderId> | null => {
  const current = pool ?? providers;
  const next = current.includes(provider)
    ? current.filter((candidate) => candidate !== provider)
    : providers.filter((candidate) => candidate === provider || current.includes(candidate));
  if (next.length === 0) {
    return pool;
  }
  return next.length === providers.length ? null : next;
};
