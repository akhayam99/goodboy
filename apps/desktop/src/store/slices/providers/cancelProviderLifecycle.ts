import type { ProviderId } from '@goodboy/types';
import { invokeProviderLifecycleCancel } from '../../../features/providers/provider-lifecycle';
import type { GetFn, SetFn } from './types';

export const cancelProviderLifecycle = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    const curr = get().providerLifecycle[providerId];
    if (!curr.runId) return;
    if (
      curr.phase !== 'installing' &&
      curr.phase !== 'connecting' &&
      curr.phase !== 'disconnecting'
    ) {
      return;
    }
    set((state) => ({
      providerLifecycle: {
        ...state.providerLifecycle,
        [providerId]: { ...curr, phase: 'cancelled' },
      },
    }));
    await invokeProviderLifecycleCancel(curr.runId);
  };
};
