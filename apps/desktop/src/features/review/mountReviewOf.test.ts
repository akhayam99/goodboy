// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type PullRequestState,
  type SessionExternalTask,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import type { BitbucketPullRequest } from '../integrations/bitbucket/client';
import type { GitlabMergeRequest } from '../integrations/gitlab/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { MountGithubState } from '../../store/types';
import type {
  MountBitbucketPrState,
  MountGitlabMrState,
} from '../../store/slices/mount-request/state';
import { mountReviewOf } from './mountReviewOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-review-host' });
const PAYMENTS = brandId<MountId>({ value: 'mount-payments' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger' });
const NOTIFY = brandId<MountId>({ value: 'mount-notify' });
const BARE = brandId<MountId>({ value: 'mount-bare' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-harborline' });
const STAMP = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

const pullRequest: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
};

const github: MountGithubState = {
  mountId: PAYMENTS,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: 'hl/fix-duplicate-credit',
  prs: [],
  links: [],
  pr: pullRequest,
  linkedIssues: [],
  fetchedAt: STAMP,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const secondRequest: PullRequestState = {
  ...pullRequest,
  number: 322,
  title: 'Retry the credit post once',
  url: 'https://github.com/harborline/payments-api/pull/322',
  headBranch: 'hl/retry-credit',
};

const bareMount: SessionProjectMount = {
  mountId: BARE,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/tmp/harborline/payments-api-bare',
  lastWorktreePath: null,
  repoRoot: '/tmp/harborline/payments-api',
  branch: 'hl/bare',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const bareGithub: MountGithubState = {
  ...github,
  mountId: BARE,
  branch: 'hl/bare',
  pr: null,
  prs: [],
};

const mergeRequest: GitlabMergeRequest = {
  id: 900,
  iid: 90,
  projectId: 3,
  title: 'Post the ledger once',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/90',
  sourceBranch: 'hl/ledger-once',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: STAMP,
};

const gitlabEntry: MountGitlabMrState = {
  kind: 'gitlab',
  mountId: LEDGER,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'gitlab.com',
  branch: 'hl/ledger-once',
  links: [],
  projectPath: 'harborline/ledger-core',
  mr: mergeRequest,
  mrs: [],
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

const bitbucketRequest: BitbucketPullRequest = {
  id: 205,
  title: 'Relay the retry header',
  description: '',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: 'hl/retry-header',
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
  webUrl: 'https://bitbucket.org/harborline/notify-relay/pull-requests/205',
};

const bitbucketEntry: MountBitbucketPrState = {
  kind: 'bitbucket',
  selected: null,
  mountId: NOTIFY,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'bitbucket.org',
  repo: {
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    workspaceSlug: 'harborline',
    repoSlug: 'notify-relay',
    email: 'nadia@harborline.test',
  },
  repository: 'harborline/notify-relay',
  branch: 'hl/retry-header',
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: bitbucketRequest,
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

type LinkParams = {
  readonly repo: string;
  readonly number: number;
};

const linkOf = ({ repo, number }: LinkParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: String(number),
  identifier: `#${number}`,
  url: `https://github.com/${repo}/pull/${number}`,
  title: 'Linked request',
  createdAt: STAMP,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    mountGithub: { [PAYMENTS]: github },
    mountRequests: { [LEDGER]: gitlabEntry, [NOTIFY]: bitbucketEntry },
  });
});

const reviewOf = (mountId: MountId | null) =>
  mountReviewOf({ state: useAppStore.getState(), sessionId: SESSION_ID, mountId });

describe('the review a page writes', () => {
  it('goes to the request of the branch on screen, one host per project', () => {
    expect(reviewOf(PAYMENTS).target).toMatchObject({
      provider: 'github',
      repo: 'harborline/payments-api',
      prNumber: 318,
    });
    expect(reviewOf(LEDGER).target).toMatchObject({
      provider: 'gitlab',
      repo: 'harborline/ledger-core',
      prNumber: 90,
    });
  });

  it('sends a Bitbucket branch to Bitbucket with its link', () => {
    expect(reviewOf(NOTIFY)).toEqual({
      kind: 'onHost',
      target: null,
      choices: [],
      hostUrl: 'https://bitbucket.org/harborline/notify-relay/pull-requests/205',
    });
  });

  it('asks which request when no single branch is on screen, and keeps the choice', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          linkOf({ repo: 'harborline/payments-api', number: 318 }),
          linkOf({ repo: 'harborline/payments-api', number: 322 }),
        ],
      },
    });

    const first = reviewOf(null);
    expect(first.choices.map((choice) => choice.prNumber)).toEqual([318, 322]);
    expect(first.target?.prNumber).toBe(318);

    const second = first.choices[1] ?? null;
    useAppStore.getState().setReviewSubmission({
      sessionId: SESSION_ID,
      patch: { chosenTarget: second },
    });
    expect(reviewOf(null).target?.prNumber).toBe(322);
  });

  it('offers nothing to write when the branch has no request', () => {
    expect(reviewOf(BARE).kind).toBe('none');
  });

  it('keeps a branch without a request off the requests of other branches in its project', () => {
    useAppStore.setState({
      sessions: [aSession({ id: SESSION_ID })],
      projects: [aProject({ id: PROJECT_ID })],
      sessionProjectMounts: { [SESSION_ID]: [bareMount] },
      mountGithub: { [PAYMENTS]: github, [BARE]: bareGithub },
      sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: [pullRequest] } },
    });

    expect(reviewOf(BARE)).toEqual({ kind: 'none', target: null, choices: [], hostUrl: null });
  });

  it('writes on the request picked on the page, not the canonical one', () => {
    useAppStore.setState({
      mountGithub: { [PAYMENTS]: { ...github, prs: [pullRequest, secondRequest] } },
      mountSelectedPr: {
        [PAYMENTS]: {
          provider: 'github',
          host: 'github.com',
          repoSlug: 'harborline/payments-api',
          prNumber: 322,
        },
      },
    });

    const review = reviewOf(PAYMENTS);
    expect(review.target?.prNumber).toBe(322);
    expect(review.choices.map((choice) => choice.prNumber)).toEqual([322]);
  });

  it('offers a branch without a request only the linked requests of its own repository', () => {
    useAppStore.setState({
      mountGithub: {
        [PAYMENTS]: github,
        [BARE]: { ...bareGithub, repository: 'harborline/ledger-core' },
      },
      sessionExternalTasks: {
        [SESSION_ID]: [
          linkOf({ repo: 'harborline/payments-api', number: 318 }),
          linkOf({ repo: 'harborline/ledger-core', number: 44 }),
        ],
      },
    });

    const review = reviewOf(BARE);
    expect(review.choices.map((choice) => `${choice.repo}#${choice.prNumber}`)).toEqual([
      'harborline/ledger-core#44',
    ]);
    expect(review.target?.repo).toBe('harborline/ledger-core');
  });
});
