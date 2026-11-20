import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import type { AskSessionParams, GetFn, SetFn } from './types';

export const stopAskReply =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId }: AskSessionParams): Promise<void> => {
    const threadId = get().askThreadId[sessionId] ?? null;
    const stream = threadId === null ? undefined : get().askStreams[threadId];
    if (threadId === null || stream === undefined || stream.isStopping) {
      return;
    }
    set((state) => ({
      askStreams: { ...state.askStreams, [threadId]: { ...stream, isStopping: true } },
    }));
    try {
      await activeAskBackend.cancelTurn({ runId: stream.runId });
    } catch (error) {
      set((state) => {
        const current = state.askStreams[threadId];
        if (current === undefined || current.runId !== stream.runId) {
          return {};
        }
        return {
          askStreams: { ...state.askStreams, [threadId]: { ...current, isStopping: false } },
        };
      });
      throw error;
    }
  };
