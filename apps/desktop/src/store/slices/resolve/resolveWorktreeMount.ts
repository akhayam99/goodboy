import type { MountTargetSnapshot, SessionId } from '@goodboy/types';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountTargetSnapshot | null;
};

export const resolveWorktreeMount = ({ get, sessionId, target }: Params): string | null => {
  if (target === null) {
    return null;
  }
  const mount = selectMountById({ state: get(), sessionId, mountId: target.mountId });
  if (mount === null) {
    return null;
  }
  return mount.worktreePath === target.worktreePath ? target.worktreePath : null;
};
