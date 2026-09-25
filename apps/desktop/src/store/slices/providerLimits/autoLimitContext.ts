import { providersAtLimit } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { AppStore } from '../../store';

export type AutoLimitContext = Readonly<{
  connected: ReadonlyArray<ProviderId>;
  atLimit: ReadonlyArray<ProviderId>;
}>;

type Params = {
  readonly state: Partial<Pick<AppStore, 'providers' | 'providerLimits'>>;
  readonly nowMs?: number;
};

export const autoLimitContext = ({
  state,
  nowMs = Date.now(),
}: Params): AutoLimitContext | null => {
  const atLimit = providersAtLimit({ limits: state.providerLimits ?? {}, nowMs });
  if (atLimit.length === 0) {
    return null;
  }
  return {
    connected: (state.providers ?? [])
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id),
    atLimit,
  };
};
