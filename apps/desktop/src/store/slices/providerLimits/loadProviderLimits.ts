import { listProviderLimits } from '@goodboy/db';
import type { ProviderId, ProviderLimits } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadProviderLimits = (set: SetFn) => async (): Promise<void> => {
  try {
    const rows = await listProviderLimits({ db: tauriDatabase });
    const loaded: Partial<Record<ProviderId, ProviderLimits>> = {};
    for (const limits of rows) {
      loaded[limits.providerId] = limits;
    }
    set((state) => ({ providerLimits: { ...loaded, ...state.providerLimits } }));
  } catch (error) {
    console.error('provider limits load failed', error);
  }
};
