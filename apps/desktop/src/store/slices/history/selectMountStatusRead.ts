import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { resolveMountBaseBranch, selectMountById } from '../project-mounts/selectors';
import {
  readWorktreeStatusRead,
  worktreeStatusKey,
  type WorktreeStatusRead,
} from '../../runtime/worktreeStatuses/cache';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const selectMountStatusRead = ({
  state,
  sessionId,
  mountId,
}: Params): WorktreeStatusRead | null => {
  const mount = selectMountById({ state, sessionId, mountId });
  if (mount === null || mount.worktreePath === '') {
    return null;
  }
  const baseBranch = resolveMountBaseBranch({ mount, projects: state.projects });
  return readWorktreeStatusRead({
    key: worktreeStatusKey({
      worktreePath: mount.worktreePath,
      baseBranch: baseBranch ?? undefined,
    }),
  });
};
