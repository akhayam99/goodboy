import type { PullRequestState, SessionId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { AppState } from '../../types';

export type RequestsState = Pick<
  AppState,
  'sessionGithub' | 'mountGithub' | 'sessionGitlabMr' | 'mountGitlabMr'
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
  const sessionMr = state.sessionGitlabMr[sessionId]?.mr ?? null;
  const mountMrs = mounts.flatMap((mount) => state.mountGitlabMr[mount.mountId]?.mrs ?? []);
  return {
    prs: sessionPr === null ? mountPrs : [sessionPr, ...mountPrs],
    mrs: sessionMr === null ? mountMrs : [sessionMr, ...mountMrs],
  };
};
