import type {
  GhTokenStatus,
  WorkspaceId,
  MountId,
  MountPullRequestIdentity,
  SessionId,
  ProjectId,
  PullRequestState,
} from '@goodboy/types';
import type { MountGithubState, SessionGithubState } from '../../types';

export type GithubState = {
  readonly githubStatus: GhTokenStatus | null;
  readonly githubWorkspaceStatus: Readonly<Record<WorkspaceId, GhTokenStatus | null>>;
  readonly mountGithub: Readonly<Record<MountId, MountGithubState>>;
  readonly mountSelectedPr: Readonly<Record<MountId, MountPullRequestIdentity | null>>;
  readonly sessionGithub: Readonly<Record<SessionId, SessionGithubState>>;
  readonly sessionProjectPrs: Readonly<
    Record<SessionId, Readonly<Record<ProjectId, ReadonlyArray<PullRequestState>>>>
  >;
  readonly sessionSelectedPrNumber: Readonly<Record<SessionId, number | null>>;
};

export const githubInitialState: GithubState = {
  githubStatus: null,
  githubWorkspaceStatus: {},
  mountGithub: {},
  mountSelectedPr: {},
  sessionGithub: {},
  sessionProjectPrs: {},
  sessionSelectedPrNumber: {},
};
