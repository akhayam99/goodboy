import { listResolveThreads, upsertResolveThread } from '@goodboy/db';
import type { ResolveThread } from '@goodboy/types';
import type { tauriDatabase } from '../../../shared/lib/db';
import { withNextStage } from './withNextStage';

type Params = {
  readonly db: typeof tauriDatabase;
  readonly row: ResolveThread;
  readonly expectedRevision: number | null;
  readonly previous?: ResolveThread | null;
  readonly isCurrent?: () => boolean;
};

const storedRow = async ({
  db,
  row,
}: Pick<Params, 'db' | 'row'>): Promise<ResolveThread | undefined> =>
  (await listResolveThreads({ db, sessionId: row.sessionId })).find(
    (candidate) => candidate.threadId === row.threadId,
  );

export const saveResolveThread = async ({
  db,
  row,
  expectedRevision,
  previous,
  isCurrent = () => true,
}: Params): Promise<boolean> => {
  const before = previous === undefined ? await storedRow({ db, row }) : previous;
  if (!isCurrent()) {
    return false;
  }
  return upsertResolveThread({
    db,
    row: withNextStage({ previous: before, row }),
    expectedRevision,
  });
};
