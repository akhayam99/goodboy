import { moveRestingAutoTree, type AutoRestingPhase, type Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly from: AutoRestingPhase;
  readonly to: AutoRestingPhase;
  readonly nowMs: number;
};

export const moveAutoRestingPhase = async ({
  db,
  treeId,
  from,
  to,
  nowMs,
}: Params): Promise<void> => {
  const isMoved = await moveRestingAutoTree({ db, treeId, from, to, nowMs });
  if (!isMoved) {
    throw new Error('Auto is working again. Mark it finished once it rests.');
  }
};
