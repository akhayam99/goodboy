// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HistoryOriginAhead,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import {
  aProject,
  aSession,
  nextProjectId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  readOriginAhead: vi.fn<() => Promise<HistoryOriginAhead>>(async () => ({
    remoteSha: 'origin-sha',
    knownRemoteSha: 'origin-sha',
    commits: [],
    onlyOnline: [],
    fetchError: null,
  })),
  pushWithLease: vi.fn<() => Promise<unknown>>(async () => ({ kind: 'pushed' })),
  worktreeStatus: vi.fn<() => Promise<WorktreeStatus>>(),
}));

vi.mock('../../../features/history/historyEngine', () => ({
  readOriginAhead: h.readOriginAhead,
  pushWithLease: h.pushWithLease,
}));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));

import { resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import { forcePushSessionBranch } from './forcePushSessionBranch';
import { useAppStore, type AppStore } from '../../store';

type MountIdParams = {
  readonly value: string;
};

type MountIdHolder = {
  readonly value: MountId;
};

const holdsMountId = (params: MountIdParams): params is MountIdHolder =>
  params.value.startsWith('mount-');

const mountIdOf = ({ value }: MountIdParams): MountId => {
  const params = { value };
  if (!holdsMountId(params)) {
    throw new Error(`Not a mount id: ${value}`);
  }
  return params.value;
};

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const WORKSPACE_ID = nextWorkspaceId();
const MOUNT_ID = mountIdOf({ value: 'mount-1' });
const SIBLING_MOUNT_ID = mountIdOf({ value: 'mount-2' });

const makeState = (): AppStore => ({
  ...useAppStore.getInitialState(),
  sessions: [
    aSession({
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      activeMountId: MOUNT_ID,
      activeProjectId: PROJECT_ID,
    }),
  ],
  projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'goodboy' })],
  sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  sessionMounts: {},
  refreshSessionPr: vi.fn(async () => undefined),
  sessionProjectMounts: {
    [SESSION_ID]: [
      {
        mountId: MOUNT_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: '/worktrees/task',
        lastWorktreePath: '/worktrees/task',
        repoRoot: '/repos/goodboy',
        branch: 'ak/outgoing',
        baseBranch: null,
        parallelIndex: 0,
        isAttached: true,
        diskState: 'present',
        revision: 1,
      },
      {
        mountId: SIBLING_MOUNT_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: '/worktrees/task-2',
        lastWorktreePath: '/worktrees/task-2',
        repoRoot: '/repos/goodboy',
        branch: 'ak/sibling',
        baseBranch: null,
        parallelIndex: 1,
        isAttached: true,
        diskState: 'present',
        revision: 1,
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  resetWorktreeStatusCache();
  h.readOriginAhead.mockResolvedValue({
    remoteSha: 'origin-sha',
    knownRemoteSha: 'origin-sha',
    commits: [],
    onlyOnline: [],
    fetchError: null,
  });
  h.pushWithLease.mockResolvedValue({ kind: 'pushed' });
});

describe('forcePushSessionBranch', () => {
  it('pushes with the pre-fetch origin sha as the lease, from the mount it was handed', async () => {
    const state = makeState();

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: SIBLING_MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result).toEqual({ ok: true });
    expect(h.pushWithLease).toHaveBeenCalledWith({
      worktreePath: '/worktrees/task-2',
      branch: 'ak/sibling',
      expectedRemoteSha: 'origin-sha',
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: SIBLING_MOUNT_ID,
      force: true,
      silent: true,
    });
  });

  it('shows the origin moved copy and pushes nothing more when the lease is stale', async () => {
    const state = makeState();
    h.pushWithLease.mockResolvedValue({ kind: 'stale', message: '[rejected] stale info' });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Origin has new commits since the rewrite. Nothing was pushed.',
    });
    expect(state.refreshSessionPr).not.toHaveBeenCalled();
  });

  it('returns the push error line for any other failure', async () => {
    const state = makeState();
    h.pushWithLease.mockResolvedValue({ kind: 'failed', message: 'remote: denied' });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result).toEqual({ ok: false, error: 'remote: denied' });
  });

  it('does not push when the origin read fails', async () => {
    const state = makeState();
    h.readOriginAhead.mockRejectedValue(new Error('offline'));

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result.ok).toBe(false);
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('shows the origin moved copy and does not push when origin moved since the last look', async () => {
    const state = makeState();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-new',
      knownRemoteSha: 'origin-old',
      commits: [],
      onlyOnline: [],
      fetchError: null,
    });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Origin has new commits since the rewrite. Nothing was pushed.',
    });
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('refuses without a known remote sha and does not push', async () => {
    const state = makeState();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-sha',
      knownRemoteSha: null,
      commits: [],
      onlyOnline: [],
      fetchError: null,
    });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result.ok).toBe(false);
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('does not push when the online copy gained a commit the user was not shown', async () => {
    const state = makeState();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-sha',
      knownRemoteSha: 'origin-sha',
      commits: [],
      onlyOnline: [
        { sha: 'seen', subject: 'Fix rounding' },
        { sha: 'new', subject: 'Add retry' },
      ],
      fetchError: null,
    });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: ['seen'],
    });

    expect(result).toEqual({
      ok: false,
      error: 'The online copy changed. Check again before force pushing.',
    });
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('pushes when the fresh only-online commits are exactly the ones confirmed', async () => {
    const state = makeState();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-sha',
      knownRemoteSha: 'origin-sha',
      commits: [],
      onlyOnline: [{ sha: 'seen', subject: 'Fix rounding' }],
      fetchError: null,
    });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: ['seen', 'gone-since'],
    });

    expect(result).toEqual({ ok: true });
    expect(h.pushWithLease).toHaveBeenCalledTimes(1);
  });

  it('accepts a not checked yet confirm only when nothing is only online', async () => {
    const state = makeState();

    const clean = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: null,
    });
    expect(clean).toEqual({ ok: true });

    h.pushWithLease.mockClear();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-sha',
      knownRemoteSha: 'origin-sha',
      commits: [],
      onlyOnline: [{ sha: 'new', subject: 'Add retry' }],
      fetchError: null,
    });

    const lossy = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: null,
    });
    expect(lossy).toEqual({
      ok: false,
      error: 'The online copy changed. Check again before force pushing.',
    });
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('refuses an empty confirm when a commit exists only online now', async () => {
    const state = makeState();
    h.readOriginAhead.mockResolvedValue({
      remoteSha: 'origin-sha',
      knownRemoteSha: 'origin-sha',
      commits: [],
      onlyOnline: [{ sha: 'merge', subject: 'Merge side into feature' }],
      fetchError: null,
    });

    const result = await forcePushSessionBranch({
      get: () => state,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: [],
    });

    expect(result.ok).toBe(false);
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });
});
