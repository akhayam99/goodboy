import type { AskSessionParams, SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const closeAsk =
  ({ set }: Params) =>
  ({ sessionId }: AskSessionParams): void => {
    set((state) => ({ askPaneOpen: { ...state.askPaneOpen, [sessionId]: false } }));
  };
