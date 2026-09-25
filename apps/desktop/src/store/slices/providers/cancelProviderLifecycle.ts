import type { ProviderId } from '@goodboy/types';
import { invokeProviderLifecycleCancel } from '../../../features/providers/provider-lifecycle';
import { ACTIVE_LIFECYCLE_PHASES, type GetFn, type SetFn } from './types';

export const cancelProviderLifecycle = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    const curr = get().providerLifecycle[providerId];
    if (!curr.runId) {
      return;
    }
    if (!ACTIVE_LIFECYCLE_PHASES.has(curr.phase)) {
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
