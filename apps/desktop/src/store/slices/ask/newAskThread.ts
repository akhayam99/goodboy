import type { AskSessionParams, SetFn } from './types';

export const newAskThread =
  (set: SetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    set((state) => ({ askThreadId: { ...state.askThreadId, [sessionId]: null } }));
  };
