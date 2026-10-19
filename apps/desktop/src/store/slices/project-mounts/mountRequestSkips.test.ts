// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type MountId, type ProjectId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import type { MountGithubState } from '../../types';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import type { MountBitbucketPrState } from '../bitbucket-pr/state';
import { mountRequestOf } from './mountRowModel';

const MOUNT = brandId<MountId>({ value: 'mount-1' });
const PROJECT = brandId<ProjectId>({ value: 'project-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' });

type GithubParams = {
  readonly checks: 'success' | null;
  readonly isChecksUnknown?: boolean;
  readonly reviewDecision: 'approved' | null;
  readonly hasReviewRequests?: boolean;
};

const githubOf = ({
  checks,
  isChecksUnknown,
  reviewDecision,
  hasReviewRequests,
}: GithubParams): MountGithubState => {
  const pr = {
    number: 11,
    title: 'Per-tenant limits on payouts',
    url: 'https://github.com/acme/ledger-core/pull/11',
    state: 'open',
    mergeable: true,
    checks,
    baseBranch: 'main',
    headBranch: 'ak/limits',
    isDraft: false,
    reviewDecision,
    body: '',
    updatedAt: NOW,
    ...(isChecksUnknown === true && { checksUnknown: true }),
    ...(hasReviewRequests !== undefined && { hasReviewRequests }),
  } satisfies NonNullable<MountGithubState['pr']>;
  return {
    mountId: MOUNT,
    projectId: PROJECT,
    revision: 1,
    repository: 'acme/ledger-core',
    host: 'github.com',
    branch: pr.headBranch,
    prs: [pr],
    links: [],
    pr,
    linkedIssues: [],
    fetchedAt: NOW,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

type StateParams = {
  readonly github?: MountGithubState;
  readonly gitlab?: MountGitlabMrState;
  readonly bitbucket?: MountBitbucketPrState;
};

const stateOf = ({ github, gitlab, bitbucket }: StateParams) => ({
  mountGithub: github === undefined ? {} : { [MOUNT]: github },
  mountGitlabMr: gitlab === undefined ? {} : { [MOUNT]: gitlab },
  mountBitbucketPr: bitbucket === undefined ? {} : { [MOUNT]: bitbucket },
});

describe('mountRequestOf, steps the host proves do not apply', () => {
  it('github: no rollup entries is absent checks, an unreadable rollup is not', () => {
    const absent = mountRequestOf({
      state: stateOf({ github: githubOf({ checks: null, reviewDecision: null }) }),
      mountId: MOUNT,
    });
    const unknown = mountRequestOf({
      state: stateOf({
        github: githubOf({ checks: null, isChecksUnknown: true, reviewDecision: null }),
      }),
      mountId: MOUNT,
    });
    const present = mountRequestOf({
      state: stateOf({ github: githubOf({ checks: 'success', reviewDecision: null }) }),
      mountId: MOUNT,
    });
    expect(absent?.isChecksAbsent).toBe(true);
    expect(unknown?.isChecksAbsent).toBe(false);
    expect(present?.isChecksAbsent).toBe(false);
  });

  it('github: review is optional only with no decision and no requested reviewers', () => {
    const optional = mountRequestOf({
      state: stateOf({
        github: githubOf({ checks: null, reviewDecision: null, hasReviewRequests: false }),
      }),
      mountId: MOUNT,
    });
    const requested = mountRequestOf({
      state: stateOf({
        github: githubOf({ checks: null, reviewDecision: null, hasReviewRequests: true }),
      }),
      mountId: MOUNT,
    });
    const notRead = mountRequestOf({
      state: stateOf({ github: githubOf({ checks: null, reviewDecision: null }) }),
      mountId: MOUNT,
    });
    const decided = mountRequestOf({
      state: stateOf({
        github: githubOf({ checks: null, reviewDecision: 'approved', hasReviewRequests: false }),
      }),
      mountId: MOUNT,
    });
    expect(optional?.isReviewOptional).toBe(true);
    expect(requested?.isReviewOptional).toBe(false);
    expect(notRead?.isReviewOptional).toBe(false);
    expect(decided?.isReviewOptional).toBe(false);
  });

  const mrOf = ({
    headPipeline,
  }: Pick<GitlabMergeRequest, 'headPipeline'>): GitlabMergeRequest => ({
    id: 1,
    iid: 7,
    projectId: 3,
    title: 'Per-tenant limits on payouts',
    description: null,
    state: 'opened',
    webUrl: 'https://gitlab.example.test/acme/ledger-core/-/merge_requests/7',
    sourceBranch: 'ak/limits',
    targetBranch: 'main',
    draft: false,
    hasConflicts: false,
    mergeStatus: 'can_be_merged',
    updatedAt: NOW,
    headPipeline,
  });

  type GitlabParams = {
    readonly headPipeline: GitlabMergeRequest['headPipeline'];
    readonly approvalsLeft: number | null;
  };

  const gitlabOf = ({ headPipeline, approvalsLeft }: GitlabParams): MountGitlabMrState => ({
    mountId: MOUNT,
    projectId: PROJECT,
    revision: 1,
    host: 'gitlab.example.test',
    projectPath: 'acme/ledger-core',
    branch: 'ak/limits',
    mrs: [],
    links: [],
    mr: mrOf({ headPipeline }),
    approvals:
      approvalsLeft === null
        ? null
        : {
            approvalsRequired: approvalsLeft,
            approvalsLeft,
            userHasApproved: false,
            userCanApprove: true,
            approvedBy: [],
          },
    fetchedAt: NOW,
    loading: false,
    error: null,
  });

  it('gitlab: no head pipeline is absent checks', () => {
    const none = mountRequestOf({
      state: stateOf({ gitlab: gitlabOf({ headPipeline: null, approvalsLeft: 1 }) }),
      mountId: MOUNT,
    });
    const running = mountRequestOf({
      state: stateOf({
        gitlab: gitlabOf({ headPipeline: { id: 9, status: 'running' }, approvalsLeft: 1 }),
      }),
      mountId: MOUNT,
    });
    expect(none?.isChecksAbsent).toBe(true);
    expect(running?.isChecksAbsent).toBe(false);
  });

  it('gitlab: review is optional once approvals were read and none are left or needed', () => {
    const optional = mountRequestOf({
      state: stateOf({ gitlab: gitlabOf({ headPipeline: null, approvalsLeft: 0 }) }),
      mountId: MOUNT,
    });
    const required = mountRequestOf({
      state: stateOf({ gitlab: gitlabOf({ headPipeline: null, approvalsLeft: 2 }) }),
      mountId: MOUNT,
    });
    const notRead = mountRequestOf({
      state: stateOf({ gitlab: gitlabOf({ headPipeline: null, approvalsLeft: null }) }),
      mountId: MOUNT,
    });
    expect(optional?.isReviewOptional).toBe(true);
    expect(required?.isReviewOptional).toBe(false);
    expect(notRead?.isReviewOptional).toBe(false);
  });

  const bitbucketPr: BitbucketPullRequest = {
    id: 21,
    title: 'Per-tenant limits on payouts',
    description: '',
    state: 'OPEN',
    createdOn: NOW,
    updatedOn: NOW,
    sourceBranch: 'ak/limits',
    sourceCommit: null,
    destinationBranch: 'main',
    destinationCommit: null,
    author: null,
    reviewers: [],
    participants: [],
    closeSourceBranch: false,
    mergeCommit: null,
    commentCount: 0,
    taskCount: 0,
    webUrl: null,
  };

  type BitbucketParams = {
    readonly reviewDecision: MountBitbucketPrState['reviewDecision'];
  };

  const bitbucketOf = ({ reviewDecision }: BitbucketParams): MountBitbucketPrState => ({
    mountId: MOUNT,
    projectId: PROJECT,
    revision: 1,
    host: 'bitbucket.org',
    repo: null,
    repository: 'acme/ledger-core',
    branch: 'ak/limits',
    prs: [],
    links: [],
    checks: null,
    reviewDecision,
    pr: bitbucketPr,
    fetchedAt: NOW,
    loading: false,
    error: null,
  });

  it('bitbucket: checks are never proven absent, review is optional with no reviewers', () => {
    const noReviewers = mountRequestOf({
      state: stateOf({ bitbucket: bitbucketOf({ reviewDecision: null }) }),
      mountId: MOUNT,
    });
    const asked = mountRequestOf({
      state: stateOf({ bitbucket: bitbucketOf({ reviewDecision: 'review_required' }) }),
      mountId: MOUNT,
    });
    expect(noReviewers?.isChecksAbsent).toBeUndefined();
    expect(noReviewers?.isReviewOptional).toBe(true);
    expect(asked?.isReviewOptional).toBe(false);
  });
});
