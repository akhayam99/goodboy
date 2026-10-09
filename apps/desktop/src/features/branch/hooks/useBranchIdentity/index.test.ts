// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { GitlabMergeRequest } from '../../../integrations/gitlab/client';
import type { MountGitlabMrState } from '../../../../store/slices/gitlab-mr/state';
import { useBranchIdentity } from '.';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const WORKTREE = '/worktrees/payments-api';
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const TITLE = 'Stop retried webhooks posting a second credit';

const GITHUB_PR: PullRequestState = {
  number: 318,
  title: TITLE,
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: MOUNT.branch,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
};

const MR: GitlabMergeRequest = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: TITLE,
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
  sourceBranch: MOUNT.branch,
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
  branch: MOUNT.branch,
  mrs: [MR],
  links: [],
  mr: MR,
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    diffMountPath: { [SESSION_ID]: WORKTREE },
    sessionGithub: {},
    mountGitlabMr: {},
  });
});

afterEach(cleanup);

const identity = () =>
  renderHook(() => useBranchIdentity({ sessionId: SESSION_ID })).result.current;

describe('useBranchIdentity', () => {
  it('gives the GitHub pull request for a GitHub session', () => {
    useAppStore.setState({
      sessionGithub: {
        [SESSION_ID]: {
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
        },
      },
    });

    const result = identity();

    expect(result.pr).toBe(GITHUB_PR);
    expect(result.label).toBe(`#318 ${TITLE}`);
  });

  it('gives the merge request of the mount for a GitLab session', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: GITLAB } });

    const result = identity();

    expect(result.pr).toMatchObject({ number: 42, title: TITLE, headBranch: MOUNT.branch });
    expect(result.label).toBe(`!42 ${TITLE}`);
    expect(result.mountPath).toBe(WORKTREE);
  });

  it('names the branch when neither host has a request', () => {
    const result = identity();

    expect(result.pr).toBeNull();
    expect(result.label).toBe(MOUNT.branch);
  });

  it('keeps the same pull request object across renders of an unchanged merge request', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: GITLAB } });
    const view = renderHook(() => useBranchIdentity({ sessionId: SESSION_ID }));
    const first = view.result.current.pr;

    view.rerender();

    expect(view.result.current.pr).toBe(first);
  });
});
