import type { ProviderId, ProviderPolicy } from '@goodboy/types';

type Params = {
  readonly policy: ProviderPolicy | null;
};

export const workspaceProviderPool = ({ policy }: Params): ReadonlyArray<ProviderId> | null => {
  if (policy === null) {
    return null;
  }
  const usable = policy.filter((entry) => entry.state !== 'off').map((entry) => entry.id);
  return usable.length === 0 || usable.length === policy.length ? null : usable;
};
