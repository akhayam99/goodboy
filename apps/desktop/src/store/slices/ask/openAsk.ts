import { ASK_FOCUS_EVENT } from '../../../features/session/ask/askFocusEvent';
import { selectIsContextTabOpen } from '../contextDrawer/selectIsContextTabOpen';
import { lensPlace } from '../navigation/canonicalLocation';
import type { AskSessionParams, GetFn } from './types';

const SETTLE_MS = 60;

export const openAsk =
  (get: GetFn) =>
  ({ sessionId }: AskSessionParams): void => {
    const state = get();
    if (!selectIsContextTabOpen({ state, sessionId })) {
      state.navigate({ to: lensPlace({ state, sessionId, lens: 'context' }) });
    }
    setTimeout(() => window.dispatchEvent(new Event(ASK_FOCUS_EVENT)), SETTLE_MS);
  };
