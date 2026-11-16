import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { selectWritableMounts } from '../../../store/slices/project-mounts/selectors';

type Params = {
  readonly state: Pick<AppState, 'sessionMounts' | 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
};

export const soleTurnMountIdOf = ({ state, sessionId }: Params): MountId | null => {
  const turnMounts = selectWritableMounts({ state, sessionId }).filter(
    (mount) => mount.isAttached && mount.worktreePath !== '' && mount.branch !== '',
  );
  const only = turnMounts.length === 1 ? turnMounts[0] : undefined;
  return only === undefined ? null : only.mountId;
};
