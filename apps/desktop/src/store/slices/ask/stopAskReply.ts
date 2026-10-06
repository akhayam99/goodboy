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
    await activeAskBackend.cancelTurn({ runId: stream.runId });
  };
