import { keepResolveDraftCurrent, listResolveThreads } from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import { withNextStage } from './withNextStage';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import type { BatchUpdateParams, SliceParams } from './types';

type Params = SliceParams & BatchUpdateParams;

export const updateResolveThreads = async ({
  set,
  get,
  sessionId,
  updates,
  keepsDraft = false,
  isCurrent = () => true,
}: Params): Promise<void> => {
  const rows = [...(await listResolveThreads({ db: tauriDatabase, sessionId }))];
  if (!isCurrent()) {
    return;
  }
  const changes = typeof updates === 'function' ? updates({ rows }) : updates;
  let hasKept = false;
  for (const update of changes) {
    const index = rows.findIndex((row) => row.threadId === update.threadId);
    const previous = rows[index];
    if (
      previous === undefined ||
      (update.revision !== undefined && previous.revision !== update.revision)
    ) {
      continue;
    }
    if (!isCurrent()) {
      return;
    }
    const row = { ...previous, ...update.patch, updatedAt: Date.now() };
    if (
      await saveResolveThread({
        db: tauriDatabase,
        row,
        expectedRevision: previous.revision,
        previous,
        isCurrent,
      })
    ) {
      rows[index] = { ...withNextStage({ previous, row }), revision: previous.revision + 1 };
      if (!isCurrent()) {
        return;
      }
      if (
        keepsDraft &&
        (await keepResolveDraftCurrent({
          db: tauriDatabase,
          sessionId,
          threadId: previous.threadId,
          fromRevision: previous.revision,
        }))
      ) {
        hasKept = true;
      }
    }
  }
  if (hasKept) {
    if (!isCurrent()) {
      return;
    }
    await loadResolveQueueItemsInto({ set, sessionId, isCurrent });
    await loadResolveCandidatesInto({ set, sessionId, isCurrent });
  }
  if (!isCurrent()) {
    return;
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows,
    attempts: get().sessionResolveAttempts[sessionId] ?? [],
  });
};
