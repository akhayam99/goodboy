import type {
  ResolveAttempt,
  ResolveQueueItemWithThread,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import {
  pushFailuresByMountOf,
  resolveAttentionNotices,
  resolveAttentionOf,
  type MountOfThread,
} from './resolveAttention';
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

export const projectResolveRows = ({ set, get, sessionId, rows, attempts }: Params): void => {
  const known = get().sessionResolveThreads[sessionId];
  const mounts = get().sessionProjectMounts?.[sessionId] ?? [];
  const mountOf: MountOfThread = ({ thread }) => {
    const owned = mounts.filter((mount) => mount.projectId === thread.projectId);
    return owned.length === 1 ? (owned[0]?.mountId ?? null) : null;
  };
  const pushBefore = pushFailuresByMountOf({ threads: known ?? [], mountOf });
  const before =
    known === undefined
      ? null
      : resolveAttentionOf({
          threads: known,
          attempts: get().sessionResolveAttempts[sessionId] ?? [],
        });
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
  if (before === null) {
    return;
  }
  const after = resolveAttentionOf({ threads: rows, attempts });
  const pushAfter = pushFailuresByMountOf({ threads: rows, mountOf });
  for (const notice of resolveAttentionNotices({
    before,
    after,
    sessionId,
    pushBefore,
    pushAfter,
  })) {
    void get().emitNotification(notice);
  }
};
