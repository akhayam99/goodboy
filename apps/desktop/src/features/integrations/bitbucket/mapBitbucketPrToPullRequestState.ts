import { bitbucketPrStateKind } from '@goodboy/core';
import type {
  PullRequestChecks,
  PullRequestReviewDecision,
  PullRequestState,
} from '@goodboy/types';
import type { BitbucketPullRequest } from './client';

type Params = {
  readonly pr: BitbucketPullRequest | null;
  readonly checks: PullRequestChecks;
  readonly reviewDecision: PullRequestReviewDecision | null;
};

export const mapBitbucketPrToPullRequestState = ({
  pr,
  checks,
  reviewDecision,
}: Params): PullRequestState | null => {
  if (pr === null) {
    return null;
  }
  return {
    number: pr.id,
    title: pr.title,
    url: pr.webUrl ?? '',
    state: bitbucketPrStateKind({ state: pr.state }),
    mergeable: null,
    checks,
    baseBranch: pr.destinationBranch,
    headBranch: pr.sourceBranch,
    isDraft: false,
    reviewDecision,
    body: pr.description,
    updatedAt: pr.updatedOn,
    headSha: pr.sourceCommit,
    mergedAt: null,
    author: pr.author?.nickname ?? null,
  };
};
