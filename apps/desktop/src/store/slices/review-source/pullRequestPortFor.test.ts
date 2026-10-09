// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  run: vi.fn(async (_args: ReadonlyArray<string>, _opts: unknown) => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
  })),
}));

vi.mock('../../../features/integrations/github/github', () => ({ tauriGhRunner: { run: h.run } }));

const bb = vi.hoisted(() => ({
  decline: vi.fn(async (_target: unknown) => ({})),
  merge: vi.fn(async (_target: unknown) => ({})),
}));

vi.mock('../../../features/integrations/bitbucket/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/integrations/bitbucket/client')>()),
  bitbucketDeclinePullRequest: bb.decline,
  bitbucketMergePullRequest: bb.merge,
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import type { MountGithubState, SessionGithubState } from '../../types';
import type { MountBitbucketPrState } from '../bitbucket-pr/state';
import { pullRequestPortFor } from './pullRequestPortFor';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'ak/fix-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const PR: PullRequestState = {
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
  pr: PR,
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

const MOUNT_GITHUB: MountGithubState = {
  ...GITHUB,
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: MOUNT.branch,
  prs: [PR],
  links: [],
};

const BITBUCKET_REPO = {
  workspaceId: 'workspace-1' as WorkspaceId,
  workspaceSlug: 'harborline',
  repoSlug: 'payments-api',
  email: 'nadia@harborline.test',
};

const bitbucketPr = (over: Partial<BitbucketPullRequest> = {}): BitbucketPullRequest => ({
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: '',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: 'ak/fix-credit',
  sourceCommit: '6c20f48a9e1',
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
  ...over,
});

const bitbucketEntry = (over: Partial<MountBitbucketPrState> = {}): MountBitbucketPrState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'bitbucket.org',
  repo: BITBUCKET_REPO,
  repository: 'harborline/payments-api',
  branch: MOUNT.branch,
  prs: [bitbucketPr()],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: bitbucketPr(),
  fetchedAt: STAMP,
  loading: false,
  error: null,
  ...over,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.run.mockClear();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionGithub: { [SESSION_ID]: GITHUB },
    mountGithub: { [MOUNT_ID]: MOUNT_GITHUB },
  });
});

const portOf = (extra: { readonly prNumber?: number } = {}) =>
  pullRequestPortFor({ get: useAppStore.getState, sessionId: SESSION_ID, ...extra });

describe('pullRequestPortFor', () => {
  it('builds the GitHub port on the repository of the mount, from its folder', async () => {
    const port = portOf();

    expect(port?.nouns.long).toBe('pull request');
    await port?.close();

    expect(h.run).toHaveBeenCalledWith(
      ['pr', 'close', '318'],
      expect.objectContaining({ cwd: '/repos/payments-api', projectId: PROJECT_ID }),
    );
  });

  it('writes the pull request it is asked for, not the displayed one', async () => {
    await portOf({ prNumber: 44 })?.merge({ method: 'rebase' });

    expect(h.run).toHaveBeenCalledWith(
      ['pr', 'merge', '44', '--rebase'],
      expect.objectContaining({ cwd: '/repos/payments-api' }),
    );
  });

  it('has no port without a pull request to talk about', () => {
    useAppStore.setState({ sessionGithub: {}, mountGithub: {} });

    expect(portOf()).toBeNull();
  });

  it('has no port without a mounted repository', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION_ID]: [] } });

    expect(portOf()).toBeNull();
  });

  it('has no port yet for a GitLab merge request', () => {
    useAppStore.setState({
      sessionGithub: {},
      mountGithub: {},
      sessionGitlabMr: {
        [SESSION_ID]: {
          mr: {
            id: 1,
            iid: 57,
            projectId: 9,
            title: 'Retry dispatch with a cap',
            description: null,
            state: 'opened',
            webUrl: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
            sourceBranch: 'fix/dispatch-retry',
            targetBranch: 'main',
            draft: false,
            hasConflicts: false,
            mergeStatus: 'can_be_merged',
            updatedAt: STAMP,
          },
          fetchedAt: null,
          loading: false,
          error: null,
        },
      },
    });

    expect(portOf({ prNumber: 57 })).toBeNull();
  });

  describe('on Bitbucket', () => {
    beforeEach(() => {
      bb.decline.mockClear();
      bb.merge.mockClear();
      useAppStore.setState({
        sessionGithub: {},
        mountGithub: {},
        mountBitbucketPr: { [MOUNT_ID]: bitbucketEntry() },
      });
    });

    it('builds the Bitbucket port on the repository and the request of the mount', async () => {
      const port = portOf();

      expect(port?.nouns).toEqual({ long: 'pull request', short: 'PR', numberPrefix: '#' });
      await port?.close();

      expect(bb.decline).toHaveBeenCalledWith({ ...BITBUCKET_REPO, pullRequestId: 42 });
    });

    it('merges with the strategy of the chosen method', async () => {
      await portOf()?.merge({ method: 'merge' });

      expect(bb.merge).toHaveBeenCalledWith({
        ...BITBUCKET_REPO,
        pullRequestId: 42,
        strategy: 'merge_commit',
      });
    });

    it('writes the request it is asked for, not the displayed one', async () => {
      useAppStore.setState({
        mountBitbucketPr: {
          [MOUNT_ID]: bitbucketEntry({ prs: [bitbucketPr(), bitbucketPr({ id: 43 })] }),
        },
      });

      await portOf({ prNumber: 43 })?.close();

      expect(bb.decline).toHaveBeenCalledWith(expect.objectContaining({ pullRequestId: 43 }));
    });

    it('keeps a port for a request that was declined, so its page still reads', async () => {
      const declined = bitbucketPr({ state: 'DECLINED' });
      useAppStore.setState({
        mountBitbucketPr: { [MOUNT_ID]: bitbucketEntry({ pr: declined, prs: [declined] }) },
      });

      expect(portOf()).not.toBeNull();
    });

    it('has no port without a credential bound repository', () => {
      useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: bitbucketEntry({ repo: null }) } });

      expect(portOf()).toBeNull();
    });

    it('has no port without a request on any mount', () => {
      useAppStore.setState({
        mountBitbucketPr: { [MOUNT_ID]: bitbucketEntry({ pr: null, prs: [] }) },
      });

      expect(portOf()).toBeNull();
    });

    it('lets a GitHub request win when the session has one', async () => {
      useAppStore.setState({
        sessionGithub: { [SESSION_ID]: GITHUB },
        mountGithub: { [MOUNT_ID]: MOUNT_GITHUB },
      });

      await portOf()?.close();

      expect(h.run).toHaveBeenCalledWith(['pr', 'close', '318'], expect.anything());
      expect(bb.decline).not.toHaveBeenCalled();
    });
  });
});
