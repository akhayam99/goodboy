import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import { askThreadPicks } from './askThreadPicks';
import type { GetFn, SetFn, ShowAskThreadParams } from './types';

export const showAskThread =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, threadId }: ShowAskThreadParams): Promise<void> => {
    const claim = askThreadPicks.claim({ key: sessionId });
    const messages =
      get().askMessages[threadId] ?? (await activeAskBackend.listMessages({ threadId }));
    if (!claim.isCurrent()) {
      return;
    }
    set((state) => ({
      askThreadId: { ...state.askThreadId, [sessionId]: threadId },
      askMessages:
        state.askMessages[threadId] !== undefined
          ? state.askMessages
          : { ...state.askMessages, [threadId]: messages },
    }));
  };
