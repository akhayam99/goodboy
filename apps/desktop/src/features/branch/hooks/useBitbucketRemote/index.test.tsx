// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

const worktree = vi.hoisted(() => ({
  remote: vi.fn<(repoPath: string) => Promise<string | null>>(),
}));

vi.mock('../../../worktree/worktree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../worktree/worktree')>()),
  worktreeRemoteUrl: worktree.remote,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountBitbucketPrState } from '../../../../store/slices/bitbucket-pr/state';
import { useBitbucketRemote } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const BINDING: IntegrationBinding = {
  id: 'binding-1' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'credential-1' as IntegrationCredentialId,
  createdAt: STAMP,
  updatedAt: STAMP,
  provider: 'bitbucket',
  config: { workspaceSlug: 'harborline', email: 'nadia@harborline.test' },
};

const VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: '/work/payments-api',
  lastWorktreePath: null,
  branch: 'hl/fix-duplicate-credit',
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

const ENTRY: MountBitbucketPrState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: null,
  repo: {
    workspaceId: WORKSPACE_ID,
    workspaceSlug: 'harborline',
    repoSlug: 'payments-api',
    email: 'nadia@harborline.test',
  },
  repository: 'harborline/payments-api',
  branch: 'hl/fix-duplicate-credit',
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: null,
  fetchedAt: null,
  loading: false,
  error: null,
};

let useAppStore: StoryStore;
const refresh = vi.fn(async () => undefined);
let counter = 0;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  refresh.mockClear();
  counter += 1;
  worktree.remote.mockReset();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionMounts: { [SESSION_ID]: [VIEW] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    workspaceIntegrations: { [WORKSPACE_ID]: [BINDING] },
    mountBitbucketPr: { [MOUNT_ID]: ENTRY },
    refreshSessionBitbucketPr: refresh,
  });
});

afterEach(cleanup);

const remoteAt = (repoRoot: string) =>
  renderHook(() =>
    useBitbucketRemote({ sessionId: SESSION_ID, workspaceId: WORKSPACE_ID, repoRoot }),
  );

describe('useBitbucketRemote', () => {
  it('knows a Bitbucket remote, looks for its request once and offers the new request page', async () => {
    worktree.remote.mockResolvedValue('git@bitbucket.org:harborline/payments-api.git');

    const { result } = remoteAt(`/repos/bitbucket-${counter}`);

    await waitFor(() => expect(result.current.isBitbucket).toBe(true));
    expect(result.current.newPullRequestUrl).toBe(
      'https://bitbucket.org/harborline/payments-api/pull-requests/new?source=hl%2Ffix-duplicate-credit',
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledWith(SESSION_ID, { silent: true }));
  });

  it('leaves a GitHub remote alone and never asks Bitbucket for it', async () => {
    worktree.remote.mockResolvedValue('git@github.com:harborline/payments-api.git');

    const { result } = remoteAt(`/repos/github-${counter}`);

    await waitFor(() => expect(worktree.remote).toHaveBeenCalled());
    expect(result.current.isBitbucket).toBe(false);
    expect(result.current.newPullRequestUrl).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('still knows a Bitbucket remote without a connection, and never asks Bitbucket for it', async () => {
    useAppStore.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [] }, mountBitbucketPr: {} });
    worktree.remote.mockResolvedValue('git@bitbucket.org:harborline/payments-api.git');

    const { result } = remoteAt(`/repos/unconnected-${counter}`);

    await waitFor(() => expect(result.current.isBitbucket).toBe(true));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.newPullRequestUrl).toBe(
      'https://bitbucket.org/harborline/payments-api/pull-requests/new?source=hl%2Ffix-duplicate-credit',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not look again once the request was read', async () => {
    useAppStore.setState({
      sessionBitbucketPr: {
        [SESSION_ID]: { pr: null, fetchedAt: STAMP, loading: false, error: null },
      },
    });
    worktree.remote.mockResolvedValue('https://bitbucket.org/harborline/payments-api.git');

    const { result } = remoteAt(`/repos/read-${counter}`);

    await waitFor(() => expect(result.current.isBitbucket).toBe(true));
    expect(refresh).not.toHaveBeenCalled();
  });
});
