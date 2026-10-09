import { gitlabMergeableOf, gitlabReviewDecisionOf, stripGitlabDraftPrefix } from '@goodboy/core';
import type { PullRequestChecks, PullRequestState } from '@goodboy/types';
import type { GitlabMergeRequest, GitlabMrApprovalState } from './client';
import { gitlabMrStateKind } from './gitlabMrStateKind';

type Params = {
  readonly mr: GitlabMergeRequest | null;
  readonly approvals?: GitlabMrApprovalState | null;
};

const PIPELINE_CHECKS: Readonly<Record<string, PullRequestChecks>> = {
  success: 'success',
  failed: 'failure',
  running: 'pending',
  pending: 'pending',
  created: 'pending',
  preparing: 'pending',
  scheduled: 'pending',
  waiting_for_resource: 'pending',
};

export const mapMrToPullRequestState = ({
  mr,
  approvals = null,
}: Params): PullRequestState | null => {
  if (mr == null) {
    return null;
  }
  const pipeline = mr.headPipeline ?? null;
  return {
    number: mr.iid,
    title: stripGitlabDraftPrefix({ title: mr.title }),
    url: mr.webUrl,
    state: gitlabMrStateKind({ mr }),
    mergeable: gitlabMergeableOf({ hasConflicts: mr.hasConflicts, mergeStatus: mr.mergeStatus }),
    checks: pipeline === null ? null : (PIPELINE_CHECKS[pipeline.status] ?? null),
    baseBranch: mr.targetBranch,
    headBranch: mr.sourceBranch,
    isDraft: mr.draft,
    reviewDecision: gitlabReviewDecisionOf({ approvals }),
    body: mr.description ?? '',
    updatedAt: mr.updatedAt,
    headSha: mr.sha ?? null,
    mergedAt: mr.mergedAt ?? null,
  };
};
