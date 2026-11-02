import type { PullRequestState, SessionId } from '@goodboy/types';
import { gitlabMountOf, gitlabSessionOf } from '../mount-request/requestOf';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { AppState } from '../../types';

export type RequestsState = Pick<
  AppState,
  'sessionGithub' | 'mountGithub' | 'sessionRequests' | 'mountRequests'
> & {
  readonly sessionProjectMounts: AppState['sessionProjectMounts'] | undefined;
};

type Params = {
  readonly state: RequestsState;
  readonly sessionId: SessionId;
};

export type SessionRequests = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly mrs: ReadonlyArray<GitlabMergeRequest>;
};

export const requestsOfSession = ({ state, sessionId }: Params): SessionRequests => {
  const mounts = state.sessionProjectMounts?.[sessionId] ?? [];
  const sessionPr = state.sessionGithub[sessionId]?.pr ?? null;
  const mountPrs = mounts.flatMap((mount) => state.mountGithub[mount.mountId]?.prs ?? []);
  const sessionMr = gitlabSessionOf({ state, sessionId })?.mr ?? null;
  const mountMrs = mounts.flatMap(
    (mount) => gitlabMountOf({ state, mountId: mount.mountId })?.mrs ?? [],
  );
  return {
    prs: sessionPr === null ? mountPrs : [sessionPr, ...mountPrs],
    mrs: sessionMr === null ? mountMrs : [sessionMr, ...mountMrs],
  };
};
