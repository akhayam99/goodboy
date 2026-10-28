// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HistoryOriginAhead,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  readOriginAhead: vi.fn<() => Promise<HistoryOriginAhead>>(async () => ({
    remoteSha: 'origin-sha',
    knownRemoteSha: 'origin-sha',
    commits: [],
    onlyOnline: [],
    fetchError: null,
  })),
  pushWithLease: vi.fn<(params: unknown) => Promise<unknown>>(async () => ({ kind: 'pushed' })),
  gitPush: vi.fn<() => Promise<{ exitCode: number; stdout: string; stderr: string }>>(async () => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
  })),
  worktreeStatus: vi.fn<() => Promise<WorktreeStatus>>(),
  markHistoryPlan: vi.fn(async () => undefined),
}));

vi.mock('../../../features/history/historyEngine', () => ({
  readOriginAhead: h.readOriginAhead,
  pushWithLease: h.pushWithLease,
}));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));
vi.mock('../../../features/integrations/github/github', () => ({ gitPush: h.gitPush }));
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({ markHistoryPlan: h.markHistoryPlan }),
);
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import * as editModule from '../resolve/editPostedReplies';
import { resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';
import { aRebaseRun } from '../../../features/history/testing/aRebaseRun';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { pushBranch } from './pushBranch';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });

let store: StoryStore;
const spyOnEdit = () => vi.spyOn(editModule, 'editPostedReplies');

let editPostedReplies: ReturnType<typeof spyOnEdit>;

const SESSION = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  activeMountId: MOUNT_ID,
  activeProjectId: PROJECT_ID,
});

const seed = (): void => {
  store.setState({
    sessions: [SESSION],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'ledger-core' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionMounts: {},
    refreshSessionPr: vi.fn(async () => undefined),
    refreshPrDescription: vi.fn(async () => false),
    recordSessionEvent: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    recordLocalCheck: vi.fn(),
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: '/worktrees/ledger-core',
          lastWorktreePath: '/worktrees/ledger-core',
          repoRoot: '/repos/ledger-core',
          branch: 'hl/feat-rates',
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
  });
};

const state = (): ReturnType<StoryStore['getState']> => store.getState();

const push = (params: Parameters<ReturnType<typeof pushBranch>>[0]) =>
  pushBranch({ set: store.setState, get: store.getState })(params);

const EXPECTED = {
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  mode: 'lease',
  guard: { kind: 'expected', expectedRemoteSha: 'old-online-sha' },
} as const;

beforeAll(async () => {
  store = await importStore();
  editPostedReplies = spyOnEdit();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  editPostedReplies.mockResolvedValue(0);
  resetWorktreeStatusCache();
  seed();
  h.pushWithLease.mockResolvedValue({ kind: 'pushed' });
  h.gitPush.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  h.readOriginAhead.mockResolvedValue({
    remoteSha: 'origin-sha',
    knownRemoteSha: 'origin-sha',
    commits: [],
    onlyOnline: [],
    fetchError: null,
  });
});

describe('pushBranch plain', () => {
  it('pushes the branch and says nothing about history', async () => {
    store.setState({
      historyRuns: { [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, phase: 'applied' }) },
    });

    const result = await push({ sessionId: SESSION_ID, mountId: MOUNT_ID, mode: 'plain' });

    expect(result).toEqual({ ok: true });
    expect(h.gitPush).toHaveBeenCalledTimes(1);
    expect(h.pushWithLease).not.toHaveBeenCalled();
    expect(state().historyRuns[MOUNT_ID]?.phase).toBe('applied');
    expect(editPostedReplies).not.toHaveBeenCalled();
  });

  it('hands back the git line as a failure', async () => {
    h.gitPush.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'rejected: non-fast-forward' });

    const result = await push({ sessionId: SESSION_ID, mountId: MOUNT_ID, mode: 'plain' });

    expect(result).toEqual({ ok: false, error: 'rejected: non-fast-forward', reason: 'failed' });
  });
});

describe('pushBranch with a lease the person confirmed', () => {
  const CONFIRMED = {
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    mode: 'lease',
    guard: { kind: 'confirmed', confirmedOnlyOnline: [], confirmedRemoteSha: null },
  } as const;

  it('pushes with the origin sha it read as the lease', async () => {
    const result = await push(CONFIRMED);

    expect(result).toEqual({ ok: true });
    expect(h.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRemoteSha: 'origin-sha', branch: 'hl/feat-rates' }),
    );
  });

  it('calls a stale lease moved', async () => {
    h.pushWithLease.mockResolvedValue({ kind: 'stale', message: '[rejected] stale info' });

    const result = await push(CONFIRMED);

    expect(result).toMatchObject({ ok: false, reason: 'moved' });
  });
});

describe('pushBranch with the lease a caller expects', () => {
  it('pushes the worktree and branch it was handed with the sha it expects', async () => {
    const result = await push({
      ...EXPECTED,
      guard: {
        kind: 'expected',
        expectedRemoteSha: 'old-online-sha',
        sha: 'checked-sha',
        worktreePath: '/worktrees/rebased',
        branch: 'hl/feat-rates-2',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(h.pushWithLease).toHaveBeenCalledWith({
      worktreePath: '/worktrees/rebased',
      branch: 'hl/feat-rates-2',
      expectedRemoteSha: 'old-online-sha',
      sourceSha: 'checked-sha',
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });
    expect(state().refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: MOUNT_ID,
      force: true,
      silent: true,
    });
  });

  it('calls a stale lease moved and a refusal failed, and records the hook line', async () => {
    h.pushWithLease.mockResolvedValueOnce({ kind: 'stale', message: 'stale info' });
    const moved = await push(EXPECTED);
    h.pushWithLease.mockResolvedValueOnce({ kind: 'failed', message: 'pre-push hook declined' });
    const failed = await push(EXPECTED);

    expect(moved).toMatchObject({ ok: false, reason: 'moved' });
    expect(failed).toEqual({ ok: false, error: 'pre-push hook declined', reason: 'failed' });
    expect(state().recordLocalCheck).toHaveBeenLastCalledWith(
      expect.objectContaining({ mountId: MOUNT_ID, answer: { error: 'pre-push hook declined' } }),
    );
  });

  it('says the push failed when the push throws, without throwing', async () => {
    h.pushWithLease.mockRejectedValueOnce(new Error('git is busy'));

    const result = await push(EXPECTED);

    expect(result).toMatchObject({ ok: false, error: 'git is busy', reason: 'failed' });
  });
});

describe('the history side effects of a lease push', () => {
  it('settles a rebase that was waiting for its push: pushed run, event, replies, description', async () => {
    store.setState({
      historyRuns: { [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, phase: 'applied' }) },
    });

    await push(EXPECTED);

    expect(state().historyRuns[MOUNT_ID]?.phase).toBe('pushed');
    expect(editPostedReplies).toHaveBeenCalledTimes(1);
    expect(state().recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, kind: 'history_pushed' }),
    );
    expect(state().refreshPrDescription).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('settles a rebase whose earlier push failed', async () => {
    store.setState({
      historyRuns: {
        [MOUNT_ID]: aRebaseRun({
          mountId: MOUNT_ID,
          phase: 'stopped',
          stop: { reason: 'push-failed', message: 'rejected', files: [], sha: null },
        }),
      },
    });

    await push(EXPECTED);

    expect(state().historyRuns[MOUNT_ID]?.phase).toBe('pushed');
    expect(state().historyRuns[MOUNT_ID]?.stop).toBeNull();
  });

  it('leaves the run alone when the push failed', async () => {
    store.setState({
      historyRuns: { [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, phase: 'applied' }) },
    });
    h.pushWithLease.mockResolvedValue({ kind: 'failed', message: 'denied' });

    await push(EXPECTED);

    expect(state().historyRuns[MOUNT_ID]?.phase).toBe('applied');
    expect(editPostedReplies).not.toHaveBeenCalled();
  });

  it('records nothing for a branch with no waiting history run', async () => {
    await push(EXPECTED);
    store.setState({
      historyRuns: { [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, phase: 'pushed' }) },
    });
    await push(EXPECTED);

    expect(editPostedReplies).not.toHaveBeenCalled();
    expect(state().recordSessionEvent).not.toHaveBeenCalled();
  });

  it('keeps the push result when a side effect fails and tells the person once', async () => {
    store.setState({
      historyRuns: { [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, phase: 'applied' }) },
    });
    editPostedReplies.mockRejectedValueOnce(new Error('reply API is down'));

    const result = await push(EXPECTED);

    expect(result).toEqual({ ok: true });
    expect(state().reportError).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warning', sessionId: SESSION_ID }),
    );
  });
});
