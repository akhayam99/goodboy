import type { ClusterAttemptBinding, MountTargetSnapshot } from '@goodboy/types';

type Params = {
  readonly attempt: ClusterAttemptBinding;
};

export const attemptTurnTarget = ({ attempt }: Params): MountTargetSnapshot | null => {
  if (attempt.target === null || attempt.state !== 'prepared') {
    return null;
  }
  return {
    mountId: attempt.target.mountId,
    mountRevision: attempt.target.mountRevision,
    worktreePath: attempt.target.worktreePath,
  };
};
