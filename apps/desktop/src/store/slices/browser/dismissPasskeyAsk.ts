import type { SliceDeps } from '../../slice-types';
import type { SessionLiveParams } from './types';

export const dismissPasskeyAsk = ({ set, get }: SliceDeps) => {
  return ({ sessionId, liveId }: SessionLiveParams): void => {
    const ask = get().browserPasskeyAsks[sessionId]?.[liveId];
    if (ask === undefined || ask.isDismissed) {
      return;
    }
    set((state) => ({
      browserPasskeyAsks: {
        ...state.browserPasskeyAsks,
        [sessionId]: {
          ...state.browserPasskeyAsks[sessionId],
          [liveId]: { ...ask, isDismissed: true },
        },
      },
    }));
  };
};
