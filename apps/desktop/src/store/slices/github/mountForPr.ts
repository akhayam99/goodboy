import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectWritableMounts } from '../project-mounts/selectors';

type State = Pick<AppState, 'sessionMounts' | 'sessionProjectMounts' | 'mountGithub'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly prNumber: number;
};

export const selectMountForPr = ({ state, sessionId, prNumber }: Params): MountId | null => {
  const carrying = selectWritableMounts({ state, sessionId }).flatMap((mount) => {
    const mountId = mount.mountId;
    if (mountId === undefined) {
      return [];
    }
    const prs = (state.mountGithub ?? {})[mountId]?.prs ?? [];
    return prs.some((candidate) => candidate.number === prNumber) ? [mountId] : [];
  });
  const only = carrying[0];
  return carrying.length === 1 && only !== undefined ? only : null;
};
