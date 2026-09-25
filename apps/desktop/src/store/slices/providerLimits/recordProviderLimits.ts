import { mergeProviderLimits } from '@goodboy/core';
import { upsertProviderLimits } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, RecordProviderLimitsParams, SetFn } from './types';

export const recordProviderLimits =
  (set: SetFn, get: GetFn) =>
  async ({ limits }: RecordProviderLimitsParams): Promise<void> => {
    const previous = get().providerLimits[limits.providerId];
    if (previous != null && Date.parse(previous.observedAt) > Date.parse(limits.observedAt)) {
      return;
    }
    const nowMs = Date.now();
    const merged = mergeProviderLimits({ previous, next: limits, nowMs });
    set((state) => ({
      providerLimits: { ...state.providerLimits, [merged.providerId]: merged },
    }));
    try {
      await upsertProviderLimits({ db: tauriDatabase, limits: merged, nowMs });
    } catch (error) {
      console.error('provider limits save failed', error);
    }
  };
