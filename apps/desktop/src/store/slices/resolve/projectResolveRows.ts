import type {
  ResolveAttempt,
  ResolveQueueItemWithThread,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import {
  resolveAttentionOf,
  resolveAttentionRaised,
  type ResolveAttention,
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

const notifyRaised = ({
  get,
  sessionId,
  after,
  raised,
}: {
  readonly get: SliceParams['get'];
  readonly sessionId: SessionId;
  readonly after: ResolveAttention;
  readonly raised: ReturnType<typeof resolveAttentionRaised>;
}): void => {
  if (raised.needsYou) {
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: 'A fix run needs you',
      body: `${after.needsYou === 1 ? '1 comment waits' : `${after.needsYou} comments wait`} for your answer.`,
      sessionId,
      action: { kind: 'open-activity', sessionId },
      coalesceKey: `fix-run-needs-you:${sessionId}`,
    });
  }
  if (raised.couldntFix) {
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `A fix run couldn't fix ${after.couldntFix === 1 ? 'a comment' : `${after.couldntFix} comments`}`,
      body: 'Retry it in the run or start over from the Comments tab.',
      sessionId,
      action: { kind: 'open-activity', sessionId },
      coalesceKey: `fix-run-couldnt-fix:${sessionId}`,
    });
  }
};

export const projectResolveRows = ({ set, get, sessionId, rows, attempts }: Params): void => {
  const known = get().sessionResolveThreads[sessionId];
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
  notifyRaised({ get, sessionId, after, raised: resolveAttentionRaised({ before, after }) });
};
