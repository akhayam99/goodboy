import type { ProviderId } from '@goodboy/types';
import { disposeConnectRun } from './connectRuns';
import { IDLE_CONNECT, type SetFn } from './types';

export const dismissProviderConnect = (set: SetFn) => {
  return (providerId: ProviderId): void => {
    disposeConnectRun({ providerId });
    set((state) => ({
      providerConnect: { ...state.providerConnect, [providerId]: IDLE_CONNECT },
    }));
  };
};
