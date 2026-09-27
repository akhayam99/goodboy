import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';

const statusAhead = (ahead: number): WorktreeStatus => ({
  branch: 'ak/sibling',
  head: 'head-sha',
  headSubject: 'work',
  upstreamDistance: { kind: 'known', ahead, behind: 0 },
  mainDistance: { kind: 'known', ahead: 8, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/ak/sibling',
  inProgress: null,
});

const h = vi.hoisted(() => ({
  gitPush: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
  worktreeStatus: vi.fn<() => Promise<WorktreeStatus>>(),
}));

vi.mock('../../../features/github/github', () => ({ gitPush: h.gitPush }));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));

import {
  ensure,
  readWorktreeStatus,
  resetWorktreeStatusCache,
  worktreeStatusKey,
} from '../../../features/session/hooks/useWorktreeStatuses/cache';
import { branchPushStateOf } from '../../../shared/lib/branchPushState';
import { pushSessionBranch } from './pushSessionBranch';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_ID = 'mount-1' as MountId;
const SIBLING_MOUNT_ID = 'mount-2' as MountId;

type State = Record<string, unknown>;

const makeState = (): State => ({
  sessions: [
    {
      id: SESSION_ID,
      workspaceId: 'workspace-1',
      activeMountId: MOUNT_ID,
      activeProjectId: PROJECT_ID,
    },
  ],
  projects: [{ id: PROJECT_ID, workspaceId: 'workspace-1', kind: 'repo', name: 'goodboy' }],
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
  h.gitPush.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
});

describe('pushSessionBranch', () => {
  it('pushes from the mount it was handed, not from the write destination', async () => {
    const state = makeState();

    const result = await pushSessionBranch({
      get: (() => state) as never,
      sessionId: SESSION_ID,
      mountId: SIBLING_MOUNT_ID,
    });

    expect(result).toEqual({ ok: true });
    expect(h.gitPush).toHaveBeenCalledWith(
      '/worktrees/task-2',
      'ak/sibling',
      'workspace-1',
      PROJECT_ID,
    );
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: SIBLING_MOUNT_ID,
      force: true,
      silent: true,
    });
  });

  it('re-reads the pushed worktree, so the push count drops to zero right away', async () => {
    const state = makeState();
    const key = worktreeStatusKey({ worktreePath: '/worktrees/task-2' });
    h.worktreeStatus.mockResolvedValue(statusAhead(3));
    await ensure({ key, worktreePath: '/worktrees/task-2', maxAgeMs: 60_000 });
    const before = readWorktreeStatus(key);
    expect(before === null ? null : branchPushStateOf({ status: before })).toEqual({
      kind: 'ahead',
      ahead: 3,
    });
    h.worktreeStatus.mockResolvedValue(statusAhead(0));

    await pushSessionBranch({
      get: (() => state) as never,
      sessionId: SESSION_ID,
      mountId: SIBLING_MOUNT_ID,
    });

    await vi.waitFor(() => {
      const after = readWorktreeStatus(key);
      expect(after === null ? null : branchPushStateOf({ status: after })).toEqual({
        kind: 'in-sync',
      });
    });
  });

  it('leaves the pull request alone when the push fails', async () => {
    const state = makeState();
    h.gitPush.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'rejected' });

    const result = await pushSessionBranch({
      get: (() => state) as never,
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });

    expect(result).toEqual({ ok: false, error: 'rejected' });
    expect(state.refreshSessionPr).not.toHaveBeenCalled();
  });

  it('refuses a mount the session does not hold', async () => {
    const state = makeState();

    const result = await pushSessionBranch({
      get: (() => state) as never,
      sessionId: SESSION_ID,
      mountId: 'mount-elsewhere' as MountId,
    });

    expect(result).toEqual({
      ok: false,
      error: 'no worktree resolved for this mount to push from',
    });
    expect(h.gitPush).not.toHaveBeenCalled();
  });
});
