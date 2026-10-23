import type { ResolveThread, SessionId } from '@goodboy/types';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly patch: (thread: ResolveThread) => ResolveThread;
};

export const patchResolveThreads = ({ store, sessionId, threadIds, patch }: Params): void => {
  const wanted = new Set(threadIds);
  store.setState((state) => ({
    sessionResolveQueueItems: {
      ...state.sessionResolveQueueItems,
      [sessionId]: (state.sessionResolveQueueItems[sessionId] ?? []).map((entry) =>
        wanted.has(entry.thread.threadId) ? { ...entry, thread: patch(entry.thread) } : entry,
      ),
    },
  }));
};
