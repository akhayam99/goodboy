import type { AskSessionParams, GetFn } from './types';

export const openAsk =
  (get: GetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    get().openDrawer({ sessionId, kind: 'ask', payload: null });
  };
