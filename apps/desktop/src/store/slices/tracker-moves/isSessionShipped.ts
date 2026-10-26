import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { isMountCompleted, isMountRequestMerged } from '../project-mounts/mountRowModel';

type State = Pick<
  AppState,
  | 'projects'
  | 'sessionMounts'
  | 'sessionProjectMounts'
  | 'mountBranchObservations'
  | 'prSeries'
  | 'mountGithub'
  | 'mountGitlabMr'
  | 'mountBitbucketPr'
>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
};

export const isSessionShipped = ({ state, sessionId }: Params): boolean => {
  const mountIds = (state.sessionProjectMounts[sessionId] ?? []).flatMap((mount) =>
    mount.mountId === undefined ? [] : [mount.mountId],
  );
  if (mountIds.length === 0) {
    return false;
  }
  return (
    mountIds.every((mountId) => isMountCompleted({ state, mountId })) &&
    mountIds.some((mountId) => isMountRequestMerged({ state, mountId }))
  );
};
