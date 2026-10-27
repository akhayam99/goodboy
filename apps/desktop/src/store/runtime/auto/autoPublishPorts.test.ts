// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryMoveOutcome, MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import {
  aProject,
  aSession,
  nextProjectId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  gitPush: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
  pushWithLease: vi.fn<() => Promise<unknown>>(async () => ({ kind: 'pushed' })),
  createHistoryBackup: vi.fn(async () => 'refs/goodboy/backup/b-6b/keep-1'),
  restoreHistoryBackup: vi.fn<() => Promise<HistoryMoveOutcome>>(),
  worktreeStatus: vi.fn<() => Promise<WorktreeStatus>>(),
}));

vi.mock('../../../features/integrations/github/github', () => ({ gitPush: h.gitPush }));
vi.mock('../../../features/history/historyEngine', () => ({
  pushWithLease: h.pushWithLease,
  createHistoryBackup: h.createHistoryBackup,
  restoreHistoryBackup: h.restoreHistoryBackup,
}));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));

import { resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import { useAppStore, type AppStore } from '../../store';
import { pushBranch } from '../../slices/github/pushBranch';
import { pushAutoBranch } from './pushAutoBranch';
import { restoreAutoBackup } from './restoreAutoBackup';
import type { PushBranchParams } from './ports';

const SESSION_ID: SessionId = nextSessionId();
const PROJECT_ID = nextProjectId();
const WORKSPACE_ID = nextWorkspaceId();

type MountIdParams = {
  readonly value: string;
};

const holdsMountId = (params: MountIdParams): params is { readonly value: MountId } =>
  params.value.startsWith('mount-');

const mountIdOf = ({ value }: MountIdParams): MountId => {
  const params = { value };
  if (!holdsMountId(params)) {
    throw new Error(`Not a mount id: ${value}`);
  }
  return params.value;
};

const MOUNT_ID = mountIdOf({ value: 'mount-ledger-core' });

const makeState = (): AppStore => {
  let state: AppStore = baseState();
  const set = (patch: Partial<AppStore> | ((current: AppStore) => Partial<AppStore>)): void => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  state = { ...state, pushBranch: pushBranch({ set, get: () => state }) };
  return state;
};

const baseState = (): AppStore => ({
  ...useAppStore.getInitialState(),
  sessions: [
    aSession({
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      activeMountId: MOUNT_ID,
      activeProjectId: PROJECT_ID,
    }),
  ],
  projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'ledger-core' })],
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
        mountName: 'ledger-core',
        worktreePath: '/work/harborline/ledger-core',
        lastWorktreePath: '/work/harborline/ledger-core',
        repoRoot: '/repos/ledger-core',
        branch: 'ak/ledger-export',
        baseBranch: null,
        parallelIndex: 0,
        isAttached: true,
        diskState: 'present',
        revision: 1,
      },
    ],
  },
});

const PLAIN: PushBranchParams = {
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  worktreePath: '/work/harborline/ledger-core',
  branch: 'ak/ledger-export',
  sha: 'abc1234',
  leaseSha: null,
  isForce: false,
};

const FORCE: PushBranchParams = { ...PLAIN, leaseSha: 'remote111', isForce: true };

beforeEach(() => {
  vi.clearAllMocks();
  resetWorktreeStatusCache();
  h.gitPush.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  h.pushWithLease.mockResolvedValue({ kind: 'pushed' });
});

describe('the push port of Auto', () => {
  it('pushes the checked commit by sha for a plain push', async () => {
    const state = makeState();

    const outcome = await pushAutoBranch({ getState: () => state, params: PLAIN });

    expect(outcome).toEqual({ kind: 'pushed' });
    expect(h.gitPush).toHaveBeenCalledWith({
      cwd: '/work/harborline/ledger-core',
      branch: 'ak/ledger-export',
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      sha: 'abc1234',
    });
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('pushes nothing when the mount switched to another branch than the recorded one', async () => {
    const outcome = await pushAutoBranch({
      getState: makeState,
      params: { ...PLAIN, branch: 'ak/notify-relay' },
    });

    expect(outcome).toEqual({
      kind: 'failed',
      message: 'this mount is on ak/ledger-export now, not ak/notify-relay, so nothing was pushed',
    });
    expect(h.gitPush).not.toHaveBeenCalled();
  });

  it('carries the git error of a plain push that is refused', async () => {
    h.gitPush.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: ' ! [rejected] non-fast-forward ',
    });

    const outcome = await pushAutoBranch({ getState: makeState, params: PLAIN });

    expect(outcome).toEqual({ kind: 'failed', message: '! [rejected] non-fast-forward' });
  });

  it('force pushes with the lease on the recorded start sha and refreshes the pull request', async () => {
    const state = makeState();

    const outcome = await pushAutoBranch({ getState: () => state, params: FORCE });

    expect(outcome).toEqual({ kind: 'pushed' });
    expect(h.pushWithLease).toHaveBeenCalledWith({
      worktreePath: '/work/harborline/ledger-core',
      branch: 'ak/ledger-export',
      expectedRemoteSha: 'remote111',
      sourceSha: 'abc1234',
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: MOUNT_ID,
      force: true,
      silent: true,
    });
    expect(h.gitPush).not.toHaveBeenCalled();
  });

  it('turns a lost lease into the shipped sentence and refreshes nothing', async () => {
    const state = makeState();
    h.pushWithLease.mockResolvedValue({ kind: 'stale', message: '[rejected] stale info' });

    const outcome = await pushAutoBranch({ getState: () => state, params: FORCE });

    expect(outcome).toEqual({
      kind: 'stale',
      message: 'The online copy changed. Check again before force pushing.',
    });
    expect(state.refreshSessionPr).not.toHaveBeenCalled();
  });

  it('carries any other failure of the lease push, thrown or returned', async () => {
    h.pushWithLease.mockResolvedValueOnce({ kind: 'failed', message: 'remote: denied' });
    h.pushWithLease.mockRejectedValueOnce(new Error('offline'));

    const returned = await pushAutoBranch({ getState: makeState, params: FORCE });
    const thrown = await pushAutoBranch({ getState: makeState, params: FORCE });

    expect(returned).toEqual({ kind: 'failed', message: 'remote: denied' });
    expect(thrown.kind).toBe('failed');
  });

  it('pushes nothing when the mount moved to another worktree', async () => {
    const outcome = await pushAutoBranch({
      getState: makeState,
      params: { ...FORCE, worktreePath: '/work/harborline/elsewhere' },
    });

    expect(outcome.kind).toBe('failed');
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });

  it('force pushes nothing without the checked commit', async () => {
    const outcome = await pushAutoBranch({ getState: makeState, params: { ...FORCE, sha: null } });

    expect(outcome.kind).toBe('failed');
    expect(h.pushWithLease).not.toHaveBeenCalled();
  });
});

describe('the backup port of Auto', () => {
  const RESTORE = {
    worktreePath: '/work/harborline/ledger-core',
    branch: 'ak/ledger-export',
    expectedHead: 'abc1234',
    backupRef: 'refs/goodboy/backup/b-6b/keep-1',
  };

  it('reads a moved branch as restored', async () => {
    h.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'base000',
      backupRef: 'refs/goodboy/backup/b-6b/1',
    });

    expect(await restoreAutoBackup(RESTORE)).toEqual({ kind: 'restored' });
    expect(h.restoreHistoryBackup).toHaveBeenCalledWith(RESTORE);
  });

  it('reads every other outcome and a thrown error as blocked with a sentence', async () => {
    const outcomes: ReadonlyArray<HistoryMoveOutcome> = [
      { kind: 'needs-stash', files: ['a.ts', 'b.ts'], dirtyCount: 2 },
      { kind: 'busy', holder: 'agent' },
      { kind: 'head-moved', head: 'later99' },
      { kind: 'blocked', reason: 'An ignored file would be overwritten.' },
    ];
    const messages: string[] = [];
    for (const outcome of outcomes) {
      h.restoreHistoryBackup.mockResolvedValueOnce(outcome);
      const result = await restoreAutoBackup(RESTORE);
      expect(result.kind).toBe('blocked');
      messages.push(result.kind === 'blocked' ? result.message : '');
    }
    h.restoreHistoryBackup.mockRejectedValueOnce(new Error('git failed'));
    const thrown = await restoreAutoBackup(RESTORE);

    expect(messages[0]).toContain('2 uncommitted files');
    expect(messages[3]).toBe('An ignored file would be overwritten.');
    expect(thrown).toMatchObject({ kind: 'blocked' });
  });
});
