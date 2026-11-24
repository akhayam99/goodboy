import { askThreadPicks } from './askThreadPicks';
import { isAskStreaming } from './isAskStreaming';
import type { AskSessionParams, GetFn, SetFn } from './types';

export const newAskThread =
  (set: SetFn, get: GetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    if (isAskStreaming({ state: get(), sessionId })) {
      return;
    }
    askThreadPicks.cancel({ key: sessionId });
    set((state) => ({ askThreadId: { ...state.askThreadId, [sessionId]: null } }));
  };
