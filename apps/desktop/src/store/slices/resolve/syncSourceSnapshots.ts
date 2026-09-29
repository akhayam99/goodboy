import {
  listResolveThreadFacts,
  listResolveThreads,
  setResolveThreadSourceSnapshot,
} from '@goodboy/db';
import type { PrComment, ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { nextSourceSnapshot, sourceTextOf } from './sourceSnapshot';
import { sourceFingerprint } from './sourceFingerprint';
import { loadResolveSourceChangesInto } from './loadResolveSourceChangesInto';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly prNumber: number;
  readonly comments: ReadonlyArray<PrComment>;
};

export const syncSourceSnapshots = async ({
  set,
  sessionId,
  prNumber,
  comments,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const facts = await listResolveThreadFacts({ db, sessionId });
  const now = Date.now();
  for (const row of rows) {
    if (row.prNumber !== prNumber || row.stage === 'resolved') {
      continue;
    }
    const source = sourceTextOf({ comments, threadId: row.threadId });
    const fingerprint = await sourceFingerprint({ comments, threadId: row.threadId });
    if (source === null || fingerprint === null) {
      continue;
    }
    const previous: ResolveSourceSnapshot | null =
      facts.find((fact) => fact.threadId === row.threadId)?.sourceSnapshot ?? null;
    const snapshot = nextSourceSnapshot({
      previous,
      stage: row.stage,
      fingerprint,
      source,
      now,
    });
    if (snapshot === null) {
      continue;
    }
    await setResolveThreadSourceSnapshot({
      db,
      sessionId,
      threadId: row.threadId,
      snapshot,
    });
  }
  await loadResolveSourceChangesInto({ set, sessionId });
};
