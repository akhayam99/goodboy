import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId, ProviderPolicy } from '@goodboy/types';

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly policy: ProviderPolicy | null;
};

export const runProvidersOf = ({ connected, policy }: Params): ReadonlyArray<ProviderId> => {
  const capable = connected.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  if (policy === null) {
    return capable;
  }
  return policy
    .filter((entry) => entry.state !== 'off' && capable.includes(entry.id))
    .map((entry) => entry.id);
};
