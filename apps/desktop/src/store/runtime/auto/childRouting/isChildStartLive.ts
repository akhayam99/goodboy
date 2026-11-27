import { getAutoAttempt, getAutoTree, type Database } from '@goodboy/db';
import type { AutoAttemptId, AutoTreeId } from '@goodboy/types';

type IsChildStartLiveParams = Readonly<{
  db: Database;
  treeId: AutoTreeId;
  generation: number;
  attemptId: AutoAttemptId;
}>;

export const isChildStartLive = async ({
  db,
  treeId,
  generation,
  attemptId,
}: IsChildStartLiveParams): Promise<boolean> => {
  const tree = await getAutoTree({ db, treeId });
  if (
    tree === null ||
    tree.generation !== generation ||
    tree.stopState !== 'none' ||
    tree.phase === 'stopping' ||
    tree.phase === 'stopped'
  ) {
    return false;
  }
  const attempt = await getAutoAttempt({ db, attemptId });
  return attempt !== null && attempt.generation === generation && attempt.endedAt === null;
};
