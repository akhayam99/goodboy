import type { SetFn } from '../../slice-types';
import type { StartHintCapture } from './captureStartHint';

export type SettleStartHintParams = {
  readonly capture: StartHintCapture;
};

export const settleStartHint = (set: SetFn) => {
  return ({ capture }: SettleStartHintParams): void => {
    set((state) => {
      const forSession = state.startHints[capture.sessionId];
      if (forSession?.[capture.scope]?.revision !== capture.revision) {
        return {};
      }
      const next = { ...forSession };
      delete next[capture.scope];
      return { startHints: { ...state.startHints, [capture.sessionId]: next } };
    });
  };
};
