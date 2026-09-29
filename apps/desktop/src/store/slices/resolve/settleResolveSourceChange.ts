import {
  keepResolveDraftCurrent,
  listResolveThreadFacts,
  setResolveThreadSourceSnapshot,
} from '@goodboy/db';
import { baselineSnapshot, sourceTextOf } from './sourceSnapshot';
import { rootFingerprint } from './sourceFingerprint';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { loadResolveSourceSnapshotsInto } from './loadResolveSourceSnapshotsInto';
import type { GetFn, SetFn, ThreadParams } from './types';

type Params = ThreadParams & {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly keepDraft: boolean;
};

export const settleResolveSourceChange = async ({
  set,
  get,
  sessionId,
  threadId,
  keepDraft,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const facts = await listResolveThreadFacts({ db, sessionId });
  const snapshot = facts.find((fact) => fact.threadId === threadId)?.sourceSnapshot ?? null;
  const comments = get().sessionGithub[sessionId]?.detail?.comments ?? [];
  const source = sourceTextOf({ comments, threadId });
  const fingerprint = await rootFingerprint({ comments, threadId });
  if (source !== null && fingerprint !== null) {
    await setResolveThreadSourceSnapshot({
      db,
      sessionId,
      threadId,
      snapshot: baselineSnapshot({ fingerprint, source, now: Date.now() }),
    });
  } else if (snapshot?.changed != null) {
    await setResolveThreadSourceSnapshot({
      db,
      sessionId,
      threadId,
      snapshot: { ...snapshot.changed, replyIds: snapshot.replyIds, changed: null },
    });
  }
  if (keepDraft) {
    await keepResolveDraftCurrent({ db, sessionId, threadId });
    await loadResolveQueueItemsInto({ set, sessionId });
    await loadResolveCandidatesInto({ set, sessionId });
  }
  await loadResolveSourceSnapshotsInto({ set, sessionId });
};
