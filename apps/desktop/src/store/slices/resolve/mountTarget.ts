import type { MountTargetSnapshot, SessionId, SessionProjectMount } from '@goodboy/types';
import { selectActiveMount, selectMountById } from '../project-mounts/selectors';
import type { GetFn } from './types';

type MountParams = { readonly mount: SessionProjectMount };

export const mountTargetOf = ({ mount }: MountParams): MountTargetSnapshot => ({
  mountId: mount.mountId,
  mountRevision: mount.revision,
  worktreePath: mount.worktreePath,
});

type SessionParams = { readonly get: GetFn; readonly sessionId: SessionId };

export const requireMountTarget = ({
  get,
  sessionId,
}: SessionParams): MountTargetSnapshot | null => {
  const mount = selectActiveMount({ state: get(), sessionId });
  return mount === null ? null : mountTargetOf({ mount });
};

type LiveParams = SessionParams & { readonly target: MountTargetSnapshot | null };

export const liveMountTarget = ({
  get,
  sessionId,
  target,
}: LiveParams): MountTargetSnapshot | null => {
  if (target === null) {
    return null;
  }
  const mount = selectMountById({ state: get(), sessionId, mountId: target.mountId });
  return mount === null ? null : mountTargetOf({ mount });
};
