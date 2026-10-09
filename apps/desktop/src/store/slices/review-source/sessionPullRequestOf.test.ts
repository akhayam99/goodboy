// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
} from '../../storyHarness';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import { sessionPullRequestHostOf, sessionPullRequestOf } from './sessionPullRequestOf';

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
  branch: 'hl/fix-duplicate-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const MR: GitlabMergeRequest = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
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

const APPROVALS: GitlabMrApprovalState = {
  approvalsRequired: 1,
  approvalsLeft: 0,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: [{ user: { username: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null } }],
};

const GITHUB_PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
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

const entryOf = ({
  mr,
  approvals = null,
}: {
  readonly mr: GitlabMergeRequest | null;
  readonly approvals?: GitlabMrApprovalState | null;
}): MountGitlabMrState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
  branch: MOUNT.branch,
  mrs: mr === null ? [] : [mr],
  links: [],
  mr,
  approvals,
  fetchedAt: STAMP,
  loading: false,
  error: null,
});

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
    sessionGithub: {},
    mountGitlabMr: {},
  });
});

const read = (extra: { readonly mountId?: MountId | null } = {}) =>
  sessionPullRequestOf({ state: useAppStore.getState(), sessionId: SESSION_ID, ...extra });

describe('sessionPullRequestOf', () => {
  it('is nothing when no host has a request', () => {
    expect(read()).toBeNull();
    expect(sessionPullRequestHostOf({ state: useAppStore.getState(), sessionId: SESSION_ID })).toBe(
      'github',
    );
  });

  it('gives the GitHub pull request when there is one', () => {
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
      mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR }) },
    });

    expect(read()).toBe(GITHUB_PR);
    expect(sessionPullRequestHostOf({ state: useAppStore.getState(), sessionId: SESSION_ID })).toBe(
      'github',
    );
  });

  it('gives the merge request of the active mount, mapped, when there is no pull request', () => {
    useAppStore.setState({
      mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR, approvals: APPROVALS }) },
    });

    expect(read()).toMatchObject({
      number: 42,
      state: 'open',
      reviewDecision: 'approved',
      headBranch: MOUNT.branch,
    });
    expect(sessionPullRequestHostOf({ state: useAppStore.getState(), sessionId: SESSION_ID })).toBe(
      'gitlab',
    );
  });

  it('gives the merge request of the mount it is asked for', () => {
    const other = 'mount-other' as MountId;
    useAppStore.setState({
      mountGitlabMr: {
        [MOUNT_ID]: entryOf({ mr: MR }),
        [other]: { ...entryOf({ mr: { ...MR, iid: 77 } }), mountId: other },
      },
    });

    expect(read({ mountId: other })?.number).toBe(77);
    expect(read({ mountId: MOUNT_ID })?.number).toBe(42);
  });

  it('is nothing for a mount that has no merge request', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: null }) } });

    expect(read()).toBeNull();
  });

  it('hands out the same object until the merge request or its approvals change', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR }) } });
    const first = read();
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR }) } });

    expect(read()).toBe(first);

    useAppStore.setState({
      mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR, approvals: APPROVALS }) },
    });

    expect(read()).not.toBe(first);
  });
});
