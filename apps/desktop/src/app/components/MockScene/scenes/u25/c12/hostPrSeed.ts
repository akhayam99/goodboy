import type { PullRequestState } from '@goodboy/types';
import type { InboxRecord } from '../../../../../../features/inbox/types';
import type { GitlabMergeRequest } from '../../../../../../features/integrations/gitlab/client';
import type {
  BitbucketPullRequest,
  BitbucketUser,
} from '../../../../../../features/integrations/bitbucket/client';
import { WORKSPACE_ID } from '../../BoardScene';
import { isoAgo } from './tasksSeed';

const BODY = 'Streams the ledger export so large months no longer time out.\n\nCloses #418';

const GITHUB_PR: PullRequestState = {
  number: 421,
  title: 'Stream the ledger export',
  url: 'https://example.invalid/github/harborline/ledger-core/pull/421',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'cascadia/stream-export',
  isDraft: false,
  reviewDecision: 'review_required',
  body: BODY,
  updatedAt: isoAgo({ minutes: 20 }),
  author: { login: 'cascadia-dev', avatarUrl: null },
};

type NameParams = {
  readonly name: string;
};

const GITLAB_USER = ({ name }: NameParams) => ({ username: name, name, avatarUrl: null });

const GITLAB_MR: GitlabMergeRequest = {
  id: 91,
  iid: 14,
  projectId: 7,
  title: 'Stream the ledger export',
  description: BODY,
  state: 'opened',
  webUrl: 'https://gitlab.example.invalid/harborline/ledger-core/-/merge_requests/14',
  sourceBranch: 'cascadia/stream-export',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: isoAgo({ minutes: 20 }),
  author: GITLAB_USER({ name: 'cascadia-dev' }),
  reviewers: [GITLAB_USER({ name: 'acme-ops' }), GITLAB_USER({ name: 'northwind-qa' })],
  headPipeline: { id: 3, status: 'failed' },
};

const BITBUCKET_USER = ({ name }: NameParams): BitbucketUser => ({
  uuid: name,
  accountId: null,
  nickname: name,
  displayName: name,
  avatarUrl: null,
});

const BITBUCKET_PR: BitbucketPullRequest = {
  id: 52,
  title: 'Stream the ledger export',
  description: BODY,
  state: 'OPEN',
  createdOn: isoAgo({ minutes: 600 }),
  updatedOn: isoAgo({ minutes: 20 }),
  sourceBranch: 'cascadia/stream-export',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: BITBUCKET_USER({ name: 'Cascadia Dev' }),
  reviewers: [BITBUCKET_USER({ name: 'Acme Ops' })],
  participants: [
    {
      user: BITBUCKET_USER({ name: 'Acme Ops' }),
      role: 'REVIEWER',
      approved: true,
      state: 'approved',
    },
    {
      user: BITBUCKET_USER({ name: 'Northwind QA' }),
      role: 'REVIEWER',
      approved: false,
      state: null,
    },
  ],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
};

type HostParams = {
  readonly updatedAt: string;
};

const base = ({ updatedAt }: HostParams) => ({
  title: 'Stream the ledger export',
  updatedAt,
  context: 'ledger-core',
});

export const GITHUB_PR_RECORD: InboxRecord = {
  ...base({ updatedAt: GITHUB_PR.updatedAt }),
  key: 'github:pr:421',
  provider: 'github',
  kind: 'pr',
  identifier: '#421',
  state: 'open',
  stateLabel: 'Open',
  url: GITHUB_PR.url,
  payload: { provider: 'github', kind: 'pr', pr: GITHUB_PR, role: 'author', sessionId: null },
};

export const GITLAB_MR_RECORD: InboxRecord = {
  ...base({ updatedAt: GITLAB_MR.updatedAt }),
  key: 'gitlab:mr:14',
  provider: 'gitlab',
  kind: 'mr',
  identifier: '!14',
  state: 'open',
  stateLabel: 'Open',
  url: GITLAB_MR.webUrl,
  payload: {
    provider: 'gitlab',
    kind: 'mr',
    mr: GITLAB_MR,
    host: 'https://gitlab.example.invalid',
  },
};

export const BITBUCKET_PR_RECORD: InboxRecord = {
  ...base({ updatedAt: BITBUCKET_PR.updatedOn }),
  key: 'bitbucket:pr:52',
  provider: 'bitbucket',
  kind: 'pr',
  identifier: '#52',
  state: 'open',
  stateLabel: 'Open',
  url: 'https://example.invalid/bitbucket/harborline/ledger-core/pull-requests/52',
  payload: {
    provider: 'bitbucket',
    kind: 'pr',
    pullRequest: BITBUCKET_PR,
    repo: {
      workspaceId: WORKSPACE_ID,
      workspaceSlug: 'harborline',
      repoSlug: 'ledger-core',
      email: 'dev@harborline.test',
    },
  },
};

export const HOST_BITBUCKET_STATUSES = [
  {
    key: 'PIPELINE',
    name: 'unit tests',
    state: 'FAILED',
    url: null,
    description: null,
    refname: null,
    createdOn: isoAgo({ minutes: 30 }),
    updatedOn: isoAgo({ minutes: 28 }),
  },
  {
    key: 'LINT',
    name: 'lint',
    state: 'SUCCESSFUL',
    url: null,
    description: null,
    refname: null,
    createdOn: isoAgo({ minutes: 30 }),
    updatedOn: isoAgo({ minutes: 28 }),
  },
] as const;
