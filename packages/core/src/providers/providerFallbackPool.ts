import type { ProviderId } from '@goodboy/types';

type PoolParams = {
  readonly provider: ProviderId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly enabledProviders: ReadonlyArray<ProviderId> | null;
  readonly coolingDownProviders: ReadonlyArray<ProviderId>;
};

export const taskModelProviderPool = ({
  provider,
  connectedProviders,
  enabledProviders,
  coolingDownProviders,
}: PoolParams): ReadonlyArray<ProviderId> => {
  return connectedProviders.filter((candidate) => {
    if (candidate === provider) {
      return false;
    }
    if (enabledProviders != null && !enabledProviders.includes(candidate)) {
      return false;
    }
    return !coolingDownProviders.includes(candidate);
  });
};
