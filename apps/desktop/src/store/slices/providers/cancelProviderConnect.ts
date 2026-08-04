import type { ProviderId } from '@goodboy/types';
import { invokeProviderLifecycleCancel } from '../../../features/providers/provider-lifecycle';
import { disposeConnectRun } from './connectRuns';
import { ACTIVE_CONNECT_PHASES, type GetFn, type SetFn } from './types';

export const cancelProviderConnect = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    const current = get().providerConnect[providerId];
    if (!ACTIVE_CONNECT_PHASES.has(current.phase)) {
      return;
    }
    disposeConnectRun({ providerId });
    set((state) => ({
      providerConnect: {
        ...state.providerConnect,
        [providerId]: { ...state.providerConnect[providerId], phase: 'cancelled' },
      },
    }));
    if (current.runId === null) {
      return;
    }
    await invokeProviderLifecycleCancel(current.runId);
  };
};
