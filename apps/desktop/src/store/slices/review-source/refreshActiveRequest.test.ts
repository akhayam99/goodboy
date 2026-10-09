// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionMountView,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { MountGithubState, SessionGithubState } from '../../types';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import type { MountBitbucketPrState } from '../bitbucket-pr/state';
import { refreshActiveRequest } from './refreshActiveRequest';
import { requestHostOf } from './requestHostOf';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const PR: BitbucketPullRequest = {
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: '',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: 'hl/fix-duplicate-credit',
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
  webUrl: 'https://bitbucket.org/harborline/payments-api/pull-requests/42',
};

const ENTRY: MountBitbucketPrState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'bitbucket.org',
  repo: {
    workspaceId: 'workspace-1' as WorkspaceId,
    workspaceSlug: 'harborline',
    repoSlug: 'payments-api',
    email: 'nadia@harborline.test',
  },
  repository: 'harborline/payments-api',
  branch: PR.sourceBranch,
  prs: [PR],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: PR,
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

const GITHUB_PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/fix-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
};

const GITHUB: SessionGithubState = {
  pr: GITHUB_PR,
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

const VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: '/work/payments-api',
  lastWorktreePath: null,
  branch: PR.sourceBranch,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/repos/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
};

let useAppStore: StoryStore;

const refreshGithub = vi.fn(async () => undefined);
const refreshBitbucket = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  refreshGithub.mockClear();
  refreshBitbucket.mockClear();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionMounts: { [SESSION_ID]: [VIEW] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    refreshSessionPr: refreshGithub,
    refreshSessionBitbucketPr: refreshBitbucket,
  });
});

const hostNow = () => requestHostOf({ state: useAppStore.getState(), sessionId: SESSION_ID });

describe('requestHostOf', () => {
  it('is GitHub when the session has no request at all', () => {
    expect(hostNow()).toBe('github');
  });

  it('is Bitbucket for a request that is not open any more', () => {
    const declined = { ...PR, state: 'DECLINED' as const };
    useAppStore.setState({
      mountBitbucketPr: { [MOUNT_ID]: { ...ENTRY, pr: declined, prs: [] } },
    });

    expect(hostNow()).toBe('bitbucket');
  });

  it('keeps GitHub when the session holds a GitHub request', () => {
    useAppStore.setState({
      sessionGithub: { [SESSION_ID]: GITHUB },
      mountBitbucketPr: { [MOUNT_ID]: ENTRY },
    });

    expect(hostNow()).toBe('github');
  });
});

describe('requestHostOf with a named mount', () => {
  const GITHUB_MOUNT_ID = 'mount-ledger-core' as MountId;
  const MR: GitlabMergeRequest = {
    id: 4201,
    iid: 42,
    projectId: 9,
    title: 'Retry dispatch with a cap',
    description: null,
    state: 'opened',
    webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
    sourceBranch: PR.sourceBranch,
    targetBranch: 'main',
    draft: false,
    hasConflicts: false,
    mergeStatus: 'can_be_merged',
    updatedAt: STAMP,
  };
  const GITLAB: MountGitlabMrState = {
    mountId: MOUNT_ID,
    projectId: PROJECT_ID,
    revision: 1,
    host: 'https://gitlab.com',
    projectPath: 'harborline/payments-api',
    branch: PR.sourceBranch,
    mrs: [MR],
    links: [],
    mr: MR,
    fetchedAt: STAMP,
    loading: false,
    error: null,
  };
  const GITHUB_MOUNT: MountGithubState = {
    ...GITHUB,
    mountId: GITHUB_MOUNT_ID,
    projectId: PROJECT_ID,
    revision: 1,
    repository: 'harborline/ledger-core',
    host: 'github.com',
    branch: 'ak/fix-credit',
    prs: [GITHUB_PR],
    links: [],
  };

  it('answers for that mount even when the active request lives on another host', () => {
    useAppStore.setState({
      sessionMounts: {
        [SESSION_ID]: [VIEW, { ...VIEW, id: GITHUB_MOUNT_ID, mountName: 'ledger-core' }],
      },
      sessionGithub: {},
      mountGitlabMr: { [MOUNT_ID]: GITLAB },
      mountGithub: { [GITHUB_MOUNT_ID]: GITHUB_MOUNT },
    });

    expect(hostNow()).toBe('gitlab');
    expect(
      requestHostOf({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        mountId: GITHUB_MOUNT_ID,
      }),
    ).toBe('github');
  });
});

describe('refreshActiveRequest', () => {
  it('refreshes the Bitbucket request when that is the host', async () => {
    useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: ENTRY } });

    await refreshActiveRequest({ get: useAppStore.getState, sessionId: SESSION_ID });

    expect(refreshBitbucket).toHaveBeenCalledWith(SESSION_ID, { force: true });
    expect(refreshGithub).not.toHaveBeenCalled();
  });

  it('refreshes the GitHub request otherwise, for the mount it was given', async () => {
    useAppStore.setState({ sessionGithub: { [SESSION_ID]: GITHUB } });

    await refreshActiveRequest({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });

    expect(refreshGithub).toHaveBeenCalledWith(SESSION_ID, { force: true, mountId: MOUNT_ID });
    expect(refreshBitbucket).not.toHaveBeenCalled();
  });
});
