import { ASK_FOCUS_EVENT } from '../../../features/session/ask/askFocusEvent';
import type { AskSessionParams, GetFn } from './types';

const SETTLE_MS = 60;

export const openAsk =
  (get: GetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    get().openDrawer({ kind: 'ask', sessionId, payload: null });
    setTimeout(() => window.dispatchEvent(new Event(ASK_FOCUS_EVENT)), SETTLE_MS);
  };
