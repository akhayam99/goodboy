import {
  keepResolveDraftCurrent,
  listResolveThreadFacts,
  setResolveThreadSourceSnapshot,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { loadResolveSourceChangesInto } from './loadResolveSourceChangesInto';
import type { SetFn, ThreadParams } from './types';

type Params = ThreadParams & {
  readonly set: SetFn;
  readonly keepDraft: boolean;
};

export const settleResolveSourceChange = async ({
  set,
  sessionId,
  threadId,
  keepDraft,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const facts = await listResolveThreadFacts({ db, sessionId });
  const snapshot = facts.find((fact) => fact.threadId === threadId)?.sourceSnapshot ?? null;
  if (snapshot?.changed != null) {
    await setResolveThreadSourceSnapshot({
      db,
      sessionId,
      threadId,
      snapshot: { ...snapshot.changed, changed: null },
    });
  }
  if (keepDraft) {
    await keepResolveDraftCurrent({ db, sessionId, threadId });
    await loadResolveQueueItemsInto({ set, sessionId });
    await loadResolveCandidatesInto({ set, sessionId });
  }
  await loadResolveSourceChangesInto({ set, sessionId });
};
