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
}: Params): Promise<void> => {
  const rows = [...(await listResolveThreads({ db: tauriDatabase, sessionId }))];
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
    const row = { ...previous, ...update.patch, updatedAt: Date.now() };
    if (
      await saveResolveThread({
        db: tauriDatabase,
        row,
        expectedRevision: previous.revision,
        previous,
      })
    ) {
      rows[index] = { ...withNextStage({ previous, row }), revision: previous.revision + 1 };
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
    await loadResolveQueueItemsInto({ set, sessionId });
    await loadResolveCandidatesInto({ set, sessionId });
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows,
    attempts: get().sessionResolveAttempts[sessionId] ?? [],
  });
};
