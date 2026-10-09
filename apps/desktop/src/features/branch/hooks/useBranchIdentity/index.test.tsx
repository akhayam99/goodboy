// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
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
import type { BitbucketPullRequest } from '../../../integrations/bitbucket/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountBitbucketPrState } from '../../../../store/slices/bitbucket-pr/state';
import type { SessionGithubState } from '../../../../store/types';
import { useBranchIdentity } from './index';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const PR: BitbucketPullRequest = {
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: 'hl/fix-duplicate-credit',
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
  checks: 'failure',
  reviewDecision: 'changes_requested',
  pr: PR,
  fetchedAt: STAMP,
  loading: false,
  error: null,
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

const GITHUB_PR: PullRequestState = {
  number: 318,
  title: 'Retry webhooks',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/retry',
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionMounts: { [SESSION_ID]: [VIEW] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  });
});

afterEach(cleanup);

const identity = () => renderHook(() => useBranchIdentity({ sessionId: SESSION_ID }));

describe('useBranchIdentity on a Bitbucket session', () => {
  it('maps the open request to the state the page reads, with the host and the label', () => {
    useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: ENTRY } });

    const { result } = identity();

    expect(result.current.host).toBe('bitbucket');
    expect(result.current.pr).toMatchObject({
      number: 42,
      title: 'Stop retried webhooks posting a second credit',
      state: 'open',
      checks: 'failure',
      reviewDecision: 'changes_requested',
      mergeable: null,
      isDraft: false,
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
    });
    expect(result.current.label).toBe('#42 Stop retried webhooks posting a second credit');
  });

  it('keeps null as null while the host has not answered', () => {
    useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: { ...ENTRY, pr: null, prs: [] } } });

    const { result } = identity();

    expect(result.current.pr).toBeNull();
    expect(result.current.host).toBe('github');
  });

  it('follows the request when a refresh brings new checks', () => {
    useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: { ...ENTRY, checks: 'pending' } } });
    const { result } = identity();
    expect(result.current.pr?.checks).toBe('pending');

    act(() => {
      useAppStore.setState({ mountBitbucketPr: { [MOUNT_ID]: { ...ENTRY, checks: 'success' } } });
    });

    expect(result.current.pr?.checks).toBe('success');
  });

  it('lets the GitHub request win when the session has one', () => {
    useAppStore.setState({
      sessionGithub: { [SESSION_ID]: GITHUB },
      mountBitbucketPr: { [MOUNT_ID]: ENTRY },
    });

    const { result } = identity();

    expect(result.current.host).toBe('github');
    expect(result.current.pr?.number).toBe(318);
  });
});
