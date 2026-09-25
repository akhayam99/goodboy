import { listResolveThreads, setResolveThreadStage } from '@goodboy/db';
import type { ResolveStage, ResolveThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { nextStage, type ResolveStageEvent } from './nextStage';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly event: (thread: ResolveThread) => ResolveStageEvent;
};

export const advanceResolveStage = async ({
  set,
  sessionId,
  threadIds,
  event,
}: Params): Promise<void> => {
  const rows = await listResolveThreads({ db: tauriDatabase, sessionId });
  const moved = new Map<string, ResolveStage>();
  for (const row of rows) {
    if (!threadIds.includes(row.threadId)) {
      continue;
    }
    const stage = nextStage({ stage: row.stage, event: event(row) });
    if (stage === row.stage) {
      continue;
    }
    await setResolveThreadStage({ db: tauriDatabase, sessionId, threadId: row.threadId, stage });
    moved.set(row.threadId, stage);
  }
  if (moved.size === 0) {
    return;
  }
  const restage = (thread: ResolveThread): ResolveThread => {
    const stage = moved.get(thread.threadId);
    return stage === undefined ? thread : { ...thread, stage };
  };
  set((state) => ({
    sessionResolveThreads: {
      ...state.sessionResolveThreads,
      [sessionId]: (state.sessionResolveThreads[sessionId] ?? []).map(restage),
    },
    sessionResolveQueueItems: {
      ...state.sessionResolveQueueItems,
      [sessionId]: (state.sessionResolveQueueItems[sessionId] ?? []).map((entry) => ({
        ...entry,
        thread: restage(entry.thread),
      })),
    },
  }));
};
