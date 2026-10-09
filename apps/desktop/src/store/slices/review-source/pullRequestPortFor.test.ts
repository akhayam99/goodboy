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

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { MountGithubState, SessionGithubState } from '../../types';
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
});
