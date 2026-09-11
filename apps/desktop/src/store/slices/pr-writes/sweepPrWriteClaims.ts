import { liveClaim } from './liveClaim';
import type { SetFn } from './types';

export const sweepPrWriteClaims = (set: SetFn) => {
  return (): void => {
    const now = Date.now();
    set((state) => {
      const entries = Object.entries(state.prWriteClaims);
      const live = entries.filter(([, claim]) => liveClaim({ claim, now }) !== null);
      if (live.length === entries.length) {
        return {};
      }
      return { prWriteClaims: Object.fromEntries(live) };
    });
  };
};
