import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import type { GetFn, SetFn, ShowAskThreadParams } from './types';

export const showAskThread =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, threadId }: ShowAskThreadParams): Promise<void> => {
    set((state) => ({ askThreadId: { ...state.askThreadId, [sessionId]: threadId } }));
    if (get().askMessages[threadId] !== undefined) {
      return;
    }
    const messages = await activeAskBackend.listMessages({ threadId });
    set((state) =>
      state.askMessages[threadId] !== undefined
        ? state
        : { askMessages: { ...state.askMessages, [threadId]: messages } },
    );
  };
