import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';

export type MountGitlabMrState = SessionGitlabMrState & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly host: string | null;
  readonly projectPath: string | null;
  readonly branch: string;
  readonly mrs: ReadonlyArray<GitlabMergeRequest>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export type SessionGitlabMrState = {
  readonly mr: GitlabMergeRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type GitlabMrSliceState = {
  readonly mountGitlabMr: Readonly<Record<MountId, MountGitlabMrState>>;
  readonly sessionGitlabMr: Readonly<Record<SessionId, SessionGitlabMrState>>;
};

export const initialGitlabMrState: GitlabMrSliceState = {
  mountGitlabMr: {},
  sessionGitlabMr: {},
};
