import { ASK_FOCUS_EVENT } from '../../../features/session/ask/askFocusEvent';
import type { AskSessionParams, SetFn } from './types';

const SETTLE_MS = 60;

export const openAsk =
  (set: SetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    set((state) => ({ askPaneOpen: { ...state.askPaneOpen, [sessionId]: true } }));
    setTimeout(() => {
      if (typeof window === 'undefined') {
        return;
      }
      window.dispatchEvent(new Event(ASK_FOCUS_EVENT));
    }, SETTLE_MS);
  };
