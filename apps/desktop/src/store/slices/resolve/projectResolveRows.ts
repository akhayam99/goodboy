import type {
  ResolveAttempt,
  ResolveQueueItemWithThread,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import type { SliceParams } from './types';

type Params = SliceParams & {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<ResolveThread>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
};

type RefreshParams = {
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread> | undefined;
  readonly rows: ReadonlyArray<ResolveThread>;
};

const withFreshThreads = ({
  entries,
  rows,
}: RefreshParams): ReadonlyArray<ResolveQueueItemWithThread> | undefined => {
  if (entries === undefined) {
    return undefined;
  }
  const byThreadId = new Map(rows.map((row) => [row.threadId, row]));
  return entries.map((entry) => {
    const fresh = byThreadId.get(entry.thread.threadId);
    return fresh === undefined || fresh === entry.thread ? entry : { ...entry, thread: fresh };
  });
};

export const projectResolveRows = ({ set, sessionId, rows, attempts }: Params): void => {
  set((state) => {
    const queueItems = withFreshThreads({
      entries: state.sessionResolveQueueItems[sessionId],
      rows,
    });
    return {
      sessionResolveThreads: { ...state.sessionResolveThreads, [sessionId]: rows },
      sessionResolveAttempts: { ...state.sessionResolveAttempts, [sessionId]: attempts },
      ...(queueItems !== undefined && {
        sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [sessionId]: queueItems },
      }),
    };
  });
};
