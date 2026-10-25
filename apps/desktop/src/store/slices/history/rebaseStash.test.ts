import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryMoveOutcome, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
  aRebaseRun,
} from '../../../features/history/testing/aRebaseRun';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../storyHarness';
import { resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    getDraftHistoryPlan: vi.fn(async () => null),
  }),
);

const project = aProject({ name: 'payments-api', baseBranch: 'main' });
const identity = {
  worktreePath: '/w/payments-api',
  branch: 'hl/ledger-export',
  projectId: project.id,
};
const mount: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: project.id,
  mountName: 'payments-api',
  worktreePath: identity.worktreePath,
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: identity.branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};
const input = { sessionId: A_REBASE_SESSION_ID, mountId: A_REBASE_MOUNT_ID };
const status: WorktreeStatus = {
  branch: identity.branch,
  head: 'old-head',
  headSubject: 'Acme export',
  upstream: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 7, behind: 4 },
  workingTree: { kind: 'known', staged: 1, unstaged: 1, untracked: 1, unmerged: 0, changed: 3 },
  inProgress: null,
};
const applyInput = {
  ...input,
  origin: 'rebase' as const,
  planId: null,
  newHead: 'new-head',
  expectedHead: 'old-head',
  map: [],
  shouldPush: false,
  byAgent: false,
  identity,
};
let store: Awaited<ReturnType<typeof importStore>>;
let move: HistoryMoveOutcome;
const requests: unknown[] = [];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  requests.length = 0;
  move = {
    kind: 'moved',
    head: 'new-head',
    backupRef: 'refs/goodboy/backup/hl-ledger-export/1',
    carriedCount: 3,
  };
  store.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [project],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
  });
  stubStoryInvoke({
    worktree_status: () => status,
    history_remote_lease: () => ({ kind: 'absent' }),
    worktree_commits: () => [],
    history_graph: () => null,
    history_rebase_plan: () => ({
      onto: 'main-head',
      ontoRef: 'main',
      mergeBase: 'base-head',
      head: 'old-head',
      commits: [],
      behind: 4,
      fetchError: null,
    }),
    history_plan_predict: () => ({
      isSupported: true,
      head: 'new-head',
      steps: [],
      isTreeEqual: false,
      changedFiles: [],
    }),
    history_plan_try: () => ({
      head: 'new-head',
      map: [],
      isTreeEqual: false,
      changedFiles: [],
      stop: null,
      copyPath: null,
      order: [],
      check: null,
    }),
    history_plan_apply: (args: unknown) => {
      requests.push(args);
      return move;
    },
    history_restore: (args: unknown) => {
      requests.push(args);
      return move;
    },
  });
});

describe('dirty rebase policy through the real store', () => {
  it('carries a dirty tree and reports the backend count without demanding a stash', async () => {
    await expect(store.getState().rebaseBranch(input)).resolves.toBe('rebased');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'applied',
      carriedCount: 3,
    });
    expect(requests[0]).toMatchObject({ args: { expectedHead: 'old-head', newHead: 'new-head' } });
    expect(requests[0]).not.toMatchObject({ args: { stash: true } });
  });
  it('waits for consent and retries the identical move with stash enabled once', async () => {
    move = { kind: 'needs-stash', files: ['ledger.ts'], dirtyCount: 3 };
    await store.getState().applyHistoryRewrite(applyInput);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'choosing',
      dirtyChoice: { files: ['ledger.ts'], dirtyCount: 3 },
    });
    move = { kind: 'moved', head: 'new-head', backupRef: 'backup', carriedCount: 0 };
    await store.getState().resumeHistoryMove(input);
    expect(requests[1]).toMatchObject({
      args: { expectedHead: 'old-head', newHead: 'new-head', branch: identity.branch, stash: true },
    });
    await store.getState().resumeHistoryMove(input);
    expect(requests).toHaveLength(2);
  });
  it('cancel removes the pending consent and does not issue another mutation', async () => {
    move = { kind: 'needs-stash', files: ['ledger.ts'], dirtyCount: 3 };
    await store.getState().applyHistoryRewrite(applyInput);
    store.getState().dismissHistoryRun(input);
    await store.getState().resumeHistoryMove(input);
    expect(requests).toHaveLength(1);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
  });
  it('keeps the stash SHA and moved head after a conflict and never repeats the move', async () => {
    move = {
      kind: 'restore-conflict',
      stash: 'a'.repeat(40),
      files: ['ledger.ts'],
      head: 'new-head',
      backupRef: 'backup',
    };
    await store.getState().applyHistoryRewrite(applyInput);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'restore-conflict',
      movedHead: 'new-head',
      savedStash: { sha: 'a'.repeat(40), files: ['ledger.ts'] },
    });
    await store.getState().resumeHistoryMove(input);
    expect(requests).toHaveLength(1);
  });
  it('undo asks for the same consent and retains its original expected head', async () => {
    move = { kind: 'needs-stash', files: ['ledger.ts'], dirtyCount: 3 };
    await store.getState().restoreHistory({ ...input, backupRef: 'backup', shouldPush: false });
    move = { kind: 'moved', head: 'backup-head', backupRef: 'backup-next', carriedCount: 0 };
    await store.getState().resumeHistoryMove(input);
    expect(requests[1]).toMatchObject({
      args: { expectedHead: 'old-head', backupRef: 'backup', stash: true },
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('restored');
  });
  it('brings crash-saved files back by SHA and leaves a failed retry recoverable', async () => {
    const savedStash = { sha: 'a'.repeat(40), identity, expectedHead: 'old-head', files: [] };
    store.setState({
      historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'set-aside', savedStash }) },
    });
    move = { kind: 'blocked', reason: 'Finish the merge first.' };
    await expect(store.getState().bringBackHistoryFiles(input)).rejects.toThrow(
      'Finish the merge first.',
    );
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.savedStash).toEqual(savedStash);
    move = { kind: 'files-restored', stash: savedStash.sha };
    await store.getState().bringBackHistoryFiles(input);
    expect(requests[1]).toMatchObject({
      args: { restoreStash: savedStash.sha, branch: identity.branch, expectedHead: 'old-head' },
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.savedStash).toBeUndefined();
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('restored');
  });
  it('refuses consent after the head changed and keeps the original target', async () => {
    move = { kind: 'needs-stash', files: ['ledger.ts'], dirtyCount: 3 };
    await store.getState().restoreHistory({ ...input, backupRef: 'backup', shouldPush: false });
    stubStoryInvoke({ worktree_status: () => ({ ...status, head: 'other-head' }) });
    await store.getState().resumeHistoryMove(input);
    expect(requests).toHaveLength(1);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.stop?.reason).toBe('head-moved');
  });
  it('still records the restored files after the mount identity changed', async () => {
    const savedStash = { sha: 'a'.repeat(40), identity, expectedHead: 'old-head', files: [] };
    store.setState({
      historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'set-aside', savedStash }) },
    });
    stubStoryInvoke({
      history_plan_apply: () => {
        store.setState({
          sessionProjectMounts: { [A_REBASE_SESSION_ID]: [{ ...mount, branch: 'hl/other' }] },
        });
        return { kind: 'files-restored', stash: savedStash.sha };
      },
    });
    await store.getState().bringBackHistoryFiles(input);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'restored',
      savedStash: undefined,
    });
  });
  it('shows a conflicted tree even when the mount identity changed during the move', async () => {
    stubStoryInvoke({
      worktree_status: () => status,
      history_remote_lease: () => ({ kind: 'absent' }),
      history_plan_apply: () => {
        store.setState({
          sessionProjectMounts: { [A_REBASE_SESSION_ID]: [{ ...mount, branch: 'hl/other' }] },
        });
        return {
          kind: 'restore-conflict',
          stash: 'a'.repeat(40),
          files: ['ledger.ts'],
          head: 'new-head',
          backupRef: 'backup',
        };
      },
    });
    await expect(store.getState().applyHistoryRewrite(applyInput)).resolves.toBe('stopped');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'restore-conflict',
      savedStash: { sha: 'a'.repeat(40), files: ['ledger.ts'] },
    });
  });
  it('shows set-aside files even when the run was replaced during the move', async () => {
    stubStoryInvoke({
      worktree_status: () => status,
      history_remote_lease: () => ({ kind: 'absent' }),
      history_plan_apply: () => {
        store.getState().dismissHistoryRun(input);
        return { kind: 'set-aside', stash: 'a'.repeat(40), reason: 'The branch changed.' };
      },
    });
    await store.getState().applyHistoryRewrite(applyInput);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'set-aside',
      savedStash: { sha: 'a'.repeat(40) },
    });
  });
  it('records a completed move after an identity change but never pushes it', async () => {
    const pushes: unknown[] = [];
    stubStoryInvoke({
      worktree_status: () => status,
      history_remote_lease: () => ({ kind: 'included', sha: 'remote-sha' }),
      history_plan_apply: () => {
        store.setState({
          sessionProjectMounts: { [A_REBASE_SESSION_ID]: [{ ...mount, branch: 'hl/other' }] },
        });
        return { kind: 'moved', head: 'new-head', backupRef: 'backup', carriedCount: 0 };
      },
      git_push_with_lease: (args: unknown) => {
        pushes.push(args);
        return { kind: 'pushed' };
      },
    });
    await expect(
      store.getState().applyHistoryRewrite({ ...applyInput, shouldPush: true }),
    ).resolves.toBe('applied');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('applied');
    expect(pushes).toHaveLength(0);
  });
  it('undo shows a conflicted tree even when the mount identity changed', async () => {
    stubStoryInvoke({
      worktree_status: () => status,
      history_remote_lease: () => ({ kind: 'absent' }),
      history_restore: () => {
        store.setState({
          sessionProjectMounts: { [A_REBASE_SESSION_ID]: [{ ...mount, branch: 'hl/other' }] },
        });
        return {
          kind: 'restore-conflict',
          stash: 'a'.repeat(40),
          files: ['ledger.ts'],
          head: 'backup-head',
          backupRef: 'backup',
        };
      },
    });
    await store.getState().restoreHistory({ ...input, backupRef: 'backup', shouldPush: false });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'restore-conflict',
      savedStash: { files: ['ledger.ts'] },
    });
  });
  it('forgets saved files by SHA, clears the run and keeps a failed attempt recoverable', async () => {
    const savedStash = { sha: 'a'.repeat(40), identity, expectedHead: 'old-head', files: ['a.ts'] };
    store.setState({
      historyRuns: {
        [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'restore-conflict', savedStash }),
      },
    });
    stubStoryInvoke({
      history_plan_apply: (args: unknown) => {
        requests.push(args);
        return requests.length === 1
          ? { kind: 'blocked', reason: 'Finish the merge first.' }
          : { kind: 'forgotten', stash: savedStash.sha };
      },
    });
    await expect(store.getState().forgetHistoryFiles(input)).rejects.toThrow(
      'Finish the merge first.',
    );
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.savedStash).toEqual(savedStash);
    await store.getState().forgetHistoryFiles(input);
    expect(requests[1]).toMatchObject({
      args: { forgetStash: savedStash.sha, branch: identity.branch, expectedHead: 'old-head' },
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
  });
  it('does not apply a response to a dismissed run', async () => {
    stubStoryInvoke({
      worktree_status: () => status,
      history_remote_lease: () => ({ kind: 'absent' }),
      history_plan_apply: async () => {
        store.getState().dismissHistoryRun(input);
        return move;
      },
    });
    await store.getState().applyHistoryRewrite(applyInput);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
  });
  it('records a completed move and reports cleanup failure without repeating it', async () => {
    move = { kind: 'moved', head: 'new-head', backupRef: 'backup', cleanupError: 'Stash kept.' };
    await expect(store.getState().applyHistoryRewrite(applyInput)).resolves.toBe('applied');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('applied');
    expect(store.getState().notifications[0]?.title).toBe(
      'Your files are back, but stash cleanup needs attention',
    );
    await store.getState().resumeHistoryMove(input);
    expect(requests).toHaveLength(1);
  });
  it('records undo success even when stash cleanup needs attention', async () => {
    move = { kind: 'moved', head: 'backup-head', backupRef: 'next', cleanupError: 'Stash kept.' };
    await expect(
      store.getState().restoreHistory({ ...input, backupRef: 'backup', shouldPush: false }),
    ).resolves.toBe('restored');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('restored');
    expect(store.getState().notifications[0]?.body).toBe('Stash kept.');
  });
  it('does not apply crash-saved files twice after a cleanup failure', async () => {
    const savedStash = { sha: 'a'.repeat(40), identity, expectedHead: 'old-head', files: [] };
    store.setState({
      historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'set-aside', savedStash }) },
    });
    move = { kind: 'files-restored', stash: savedStash.sha, cleanupError: 'Stash kept.' };
    await store.getState().bringBackHistoryFiles(input);
    await store.getState().bringBackHistoryFiles(input);
    expect(requests).toHaveLength(1);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('restored');
    expect(store.getState().notifications[0]?.severity).toBe('warning');
  });
});
