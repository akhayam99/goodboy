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

export type MountBitbucketPrState = SessionBitbucketPrEntry & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly host: string | null;
  readonly repo: BitbucketRepo | null;
  readonly repository: string | null;
  readonly branch: string;
  readonly prs: ReadonlyArray<BitbucketPullRequest>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
  readonly checks: PullRequestChecks;
  readonly reviewDecision: PullRequestReviewDecision | null;
};

export type SessionBitbucketPrEntry = {
  readonly pr: BitbucketPullRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type BitbucketPrSliceState = {
  readonly mountBitbucketPr: Readonly<Record<MountId, MountBitbucketPrState>>;
  readonly mountSelectedBitbucketPr: Readonly<Record<MountId, MountPullRequestIdentity | null>>;
  readonly sessionBitbucketPr: Readonly<Record<SessionId, SessionBitbucketPrEntry>>;
  readonly sessionBitbucketRepo: Readonly<Record<SessionId, BitbucketRepo>>;
};

export const initialBitbucketPrState: BitbucketPrSliceState = {
  mountBitbucketPr: {},
  mountSelectedBitbucketPr: {},
  sessionBitbucketPr: {},
  sessionBitbucketRepo: {},
};
