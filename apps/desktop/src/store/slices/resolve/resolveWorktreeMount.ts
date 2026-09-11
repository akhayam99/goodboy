import type { MountTargetSnapshot, SessionId } from '@goodboy/types';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountTargetSnapshot | null;
};

type MatchParams = {
  readonly target: MountTargetSnapshot;
  readonly worktreePath: string | null;
  readonly revision: number | null;
};

export const matchesMountTarget = ({ target, worktreePath, revision }: MatchParams): boolean =>
  worktreePath === target.worktreePath && revision === target.mountRevision;

export const resolveWorktreeMount = ({ get, sessionId, target }: Params): string | null => {
  if (target === null) {
    return null;
  }
  const mount = selectMountById({ state: get(), sessionId, mountId: target.mountId });
  if (mount === null) {
    return null;
  }
  return matchesMountTarget({
    target,
    worktreePath: mount.worktreePath,
    revision: mount.revision,
  })
    ? target.worktreePath
    : null;
};
