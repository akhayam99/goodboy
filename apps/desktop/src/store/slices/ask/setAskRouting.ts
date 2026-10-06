import type { IsoDateTime } from '@goodboy/types';
import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import type { GetFn, SetAskRoutingParams, SetFn } from './types';

export const setAskRouting =
  (set: SetFn, get: GetFn) =>
  ({ sessionId, routing }: SetAskRoutingParams): void => {
    const threadId = get().askThreadId[sessionId] ?? null;
    set((state) => ({
      askRouting: { ...state.askRouting, [sessionId]: routing },
      askThreads: {
        ...state.askThreads,
        [sessionId]: (state.askThreads[sessionId] ?? []).map((thread) =>
          thread.id === threadId ? { ...thread, ...routing } : thread,
        ),
      },
    }));
    if (threadId === null) {
      return;
    }
    void activeAskBackend
      .setThreadModel({ threadId, ...routing, now: new Date().toISOString() as IsoDateTime })
      .catch(() => undefined);
  };
