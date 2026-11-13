import type { PullRequestReviewer } from '@goodboy/types';
import type { ChecksSummary } from '../../../github/checksRollup';
import { linkedIssuesOfBody } from '../../../components/HostOverview/linkedIssuesOfBody';
import type { HostRailFacts } from '../../../components/HostOverview/types';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../client';

type Params = {
  readonly mr: GitlabMergeRequest;
  readonly approval: GitlabMrApprovalState | null;
};

type Person = NonNullable<GitlabMergeRequest['author']>;

type PersonParams = {
  readonly user: Person;
};

const gitlabPersonOf = ({ user }: PersonParams) => ({
  login: user.username,
  name: user.name,
  avatarUrl: user.avatarUrl,
});

const reviewersOf = ({ mr, approval }: Params): ReadonlyArray<PullRequestReviewer> => {
  const approvers = new Set((approval?.approvedBy ?? []).map((entry) => entry.user.username));
  const asked = mr.reviewers ?? [];
  const known = new Set(asked.map((user) => user.username));
  const approvedOnly = (approval?.approvedBy ?? [])
    .map((entry) => entry.user)
    .filter((user) => !known.has(user.username));
  return [
    ...asked.map((user) => ({
      person: gitlabPersonOf({ user }),
      state: approvers.has(user.username) ? ('approved' as const) : ('pending' as const),
    })),
    ...approvedOnly.map((user) => ({
      person: gitlabPersonOf({ user }),
      state: 'approved' as const,
    })),
  ];
};

type MrParams = {
  readonly mr: GitlabMergeRequest;
};

const PIPELINE_RUNNING = new Set([
  'created',
  'pending',
  'running',
  'preparing',
  'waiting_for_resource',
]);
const PIPELINE_FAILING = new Set(['failed', 'canceled']);

const pipelineChecksOf = ({ mr }: MrParams): ChecksSummary | null => {
  const status = mr.headPipeline?.status;
  if (status === undefined) {
    return null;
  }
  if (status === 'success') {
    return {
      total: 1,
      passed: 1,
      failing: 0,
      running: 0,
      line: '1 of 1 passed',
      failingNames: [],
    };
  }
  if (PIPELINE_FAILING.has(status)) {
    return {
      total: 1,
      passed: 0,
      failing: 1,
      running: 0,
      line: '0 of 1 passed',
      failingNames: ['Pipeline'],
    };
  }
  if (PIPELINE_RUNNING.has(status)) {
    return {
      total: 1,
      passed: 0,
      failing: 0,
      running: 1,
      line: '0 of 1 passed',
      failingNames: [],
    };
  }
  return null;
};

export const gitlabMrRailOf = ({ mr, approval }: Params): HostRailFacts => ({
  author: mr.author == null ? null : { login: mr.author.username, avatarUrl: mr.author.avatarUrl },
  reviewers: reviewersOf({ mr, approval }),
  checks: pipelineChecksOf({ mr }),
  linked: linkedIssuesOfBody({ body: mr.description ?? '' }),
});
