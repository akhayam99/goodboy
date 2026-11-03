import type {
  IsoDateTime,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  ProjectId,
  PullRequestChecks,
  PullRequestReviewDecision,
  SessionId,
} from '@goodboy/types';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../../../features/integrations/bitbucket/client';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';

type RequestFetch = {
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt?: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

type MountRequestBase = RequestFetch & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly host: string | null;
  readonly branch: string;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export type MountGitlabMrState = MountRequestBase & {
  readonly kind: 'gitlab';
  readonly projectPath: string | null;
  readonly mr: GitlabMergeRequest | null;
  readonly mrs: ReadonlyArray<GitlabMergeRequest>;
  readonly approvals?: GitlabMrApprovalState | null;
};

export type MountBitbucketPrState = MountRequestBase & {
  readonly kind: 'bitbucket';
  readonly repo: BitbucketRepo | null;
  readonly repository: string | null;
  readonly pr: BitbucketPullRequest | null;
  readonly prs: ReadonlyArray<BitbucketPullRequest>;
  readonly checks: PullRequestChecks;
  readonly reviewDecision: PullRequestReviewDecision | null;
  readonly selected: MountPullRequestIdentity | null;
};

export type MountRequestState = MountGitlabMrState | MountBitbucketPrState;

export type SessionGitlabMrState = RequestFetch & {
  readonly kind: 'gitlab';
  readonly mr: GitlabMergeRequest | null;
  readonly approvals?: GitlabMrApprovalState | null;
};

export type SessionBitbucketPrEntry = RequestFetch & {
  readonly kind: 'bitbucket';
  readonly pr: BitbucketPullRequest | null;
};

export type SessionRequestState = SessionGitlabMrState | SessionBitbucketPrEntry;

export type MountRequestSliceState = {
  readonly mountRequests: Readonly<Record<MountId, MountRequestState>>;
  readonly sessionRequests: Readonly<Record<SessionId, SessionRequestState>>;
};

export const mountRequestInitialState: MountRequestSliceState = {
  mountRequests: {},
  sessionRequests: {},
};
