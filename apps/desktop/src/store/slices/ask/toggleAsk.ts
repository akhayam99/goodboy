import type { AskSessionParams, GetFn } from './types';

export const toggleAsk =
  (get: GetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    get().toggleDrawer({ sessionId, kind: 'ask', payload: null });
  };
