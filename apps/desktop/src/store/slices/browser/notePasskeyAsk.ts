import type { SliceDeps } from '../../slice-types';
import { withoutPasskeyAsk } from './withoutPasskeyAsk';
import type { PasskeyAskParams } from './types';

export const notePasskeyAsk = ({ set, get }: SliceDeps) => {
  return ({ sessionId, liveId, host, isAsked }: PasskeyAskParams): void => {
    const state = get();
    if (!isAsked && state.browserPasskeyAsks[sessionId]?.[liveId] === undefined) {
      return;
    }
    if (!isAsked) {
      set((current) => ({
        browserPasskeyAsks: withoutPasskeyAsk({
          asks: current.browserPasskeyAsks,
          sessionId,
          liveId,
        }),
      }));
      return;
    }
    if (!Object.values(state.browserLiveTabs[sessionId] ?? {}).includes(liveId)) {
      return;
    }
    set((current) => ({
      browserPasskeyAsks: {
        ...current.browserPasskeyAsks,
        [sessionId]: {
          ...current.browserPasskeyAsks[sessionId],
          [liveId]: { host, isDismissed: false },
        },
      },
    }));
  };
};
