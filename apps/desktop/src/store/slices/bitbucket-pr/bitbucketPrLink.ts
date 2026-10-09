import type {
  IsoDateTime,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
} from '@goodboy/types';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../../../features/integrations/bitbucket/client';
import { bitbucketPrStateKind } from '@goodboy/core';
import { buildMountRequestLink, requestHost } from '../project-mounts/mountRequests';

const BITBUCKET_HOST = 'bitbucket.org';

type RepositoryParams = {
  readonly workspaceSlug: string;
  readonly repoSlug: string;
};

type IdentityParams = {
  readonly repo: BitbucketRepo;
  readonly pullRequestId: number;
  readonly url?: string | null;
};

type LinkParams = {
  readonly mountId: MountId;
  readonly repo: BitbucketRepo;
  readonly pr: BitbucketPullRequest;
  readonly existing: MountPullRequestLink | null;
  readonly observedAt: IsoDateTime;
};

type SnapshotParams = {
  readonly link: MountPullRequestLink;
};

const isPullRequest = (value: unknown): value is BitbucketPullRequest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return (
    typeof record.id === 'number' &&
    typeof record.title === 'string' &&
    typeof record.state === 'string' &&
    typeof record.sourceBranch === 'string'
  );
};

export const bitbucketRepository = ({ workspaceSlug, repoSlug }: RepositoryParams): string =>
  `${workspaceSlug}/${repoSlug}`;

export const bitbucketRequestUrl = ({ repo, pullRequestId, url }: IdentityParams): string =>
  url ??
  `https://${BITBUCKET_HOST}/${bitbucketRepository({ workspaceSlug: repo.workspaceSlug, repoSlug: repo.repoSlug })}/pull-requests/${pullRequestId}`;

export const bitbucketRequestIdentity = ({
  repo,
  pullRequestId,
  url,
}: IdentityParams): MountPullRequestIdentity => ({
  provider: 'bitbucket',
  host: requestHost({
    url: bitbucketRequestUrl({ repo, pullRequestId, url }),
    fallback: BITBUCKET_HOST,
  }),
  repoSlug: bitbucketRepository({
    workspaceSlug: repo.workspaceSlug,
    repoSlug: repo.repoSlug,
  }),
  prNumber: pullRequestId,
});

export const toMountBitbucketPrLink = ({
  mountId,
  repo,
  pr,
  existing,
  observedAt,
}: LinkParams): MountPullRequestLink =>
  buildMountRequestLink({
    mountId,
    identity: bitbucketRequestIdentity({ repo, pullRequestId: pr.id, url: pr.webUrl }),
    headBranch: pr.sourceBranch,
    baseBranch: pr.destinationBranch,
    url: bitbucketRequestUrl({ repo, pullRequestId: pr.id, url: pr.webUrl }),
    state: bitbucketPrStateKind({ state: pr.state }),
    snapshot: pr,
    headSha: pr.sourceCommit,
    existing,
    observedAt,
  });

export const pullRequestFromLink = ({ link }: SnapshotParams): BitbucketPullRequest | null =>
  isPullRequest(link.snapshot) ? link.snapshot : null;
