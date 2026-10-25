import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryRewriterCheck, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  A_REBASE_AGENT_ID,
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
const target = { sessionId: A_REBASE_SESSION_ID, mountId: A_REBASE_MOUNT_ID };
const binding = {
  ...target,
  copyPath: '/copies/ledger-core',
  origin: 'rebase' as const,
  planId: null,
  identity,
  plan: { worktreePath: identity.worktreePath, base: 'base', head: 'old-head', steps: [] },
};
const check: HistoryRewriterCheck = {
  head: null,
  map: [],
  problems: ['The result differs.'],
  isTreeEqual: false,
  changedFiles: [],
  unexpectedFiles: ['webhook.ts'],
  review: { copyHead: 'copy-head', diff: '', keptUntil: 4_000_000_000 },
};
const status: WorktreeStatus = {
  branch: identity.branch,
  head: 'old-head',
  headSubject: 'Acme export',
  upstream: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 2, behind: 1 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};
let store: Awaited<ReturnType<typeof importStore>>;
let isDiscardFailed = false;
let wasDiscarded = false;

const invokeHandlers: Parameters<typeof stubStoryInvoke>[0] = {
  history_rewriter_collect: () => ({
    ...check,
    head: 'new-head',
    map: [{ from: 'old-head', to: 'new-head' }],
    problems: [],
    review: null,
  }),
  history_copy_discard: () => {
    if (isDiscardFailed) {
      throw new Error('Acme copy is locked');
    }
    wasDiscarded = true;
  },
  worktree_status: () => status,
  history_remote_lease: () => ({ kind: 'absent' }),
  history_plan_apply: () => ({
    kind: 'moved',
    head: 'new-head',
    backupRef: 'refs/goodboy/backup/1',
  }),
  worktree_commits: () => [],
  history_graph: () => null,
  history_backups_list: () => [],
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  isDiscardFailed = false;
  wasDiscarded = false;
  store.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [project],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
    sessionEvents: { [A_REBASE_SESSION_ID]: [] },
    historyRewriters: { [A_REBASE_AGENT_ID]: binding },
    historyRuns: {
      [A_REBASE_MOUNT_ID]: aRebaseRun({
        phase: 'stopped',
        agentId: A_REBASE_AGENT_ID,
        copyPath: binding.copyPath,
        identity,
        stop: {
          reason: 'invalid',
          message: 'The result differs.',
          files: check.unexpectedFiles,
          sha: null,
          review: check.review,
        },
      }),
    },
  });
  stubStoryInvoke(invokeHandlers);
});

describe('reviewing a stopped rebase', () => {
  it('carries the structured unexpected files onto the stop', async () => {
    stubStoryInvoke({ history_rewriter_collect: () => check });
    await store.getState().settleHistoryRewriter({
      sessionId: A_REBASE_SESSION_ID,
      agentId: A_REBASE_AGENT_ID,
      assistantText: '<<history-done head="copy-head">>',
      hasFailed: false,
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.stop).toMatchObject({
      reason: 'invalid',
      files: ['webhook.ts'],
      review: check.review,
    });
  });

  it('applies through the normal move and retains its backup and journal', async () => {
    await store.getState().acceptHistoryChange(target);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'applied',
      backupRef: 'refs/goodboy/backup/1',
    });
    expect(
      store
        .getState()
        .sessionEvents[A_REBASE_SESSION_ID]?.some((event) => event.kind === 'history_rewritten'),
    ).toBe(true);
    expect(store.getState().historyRewriters[A_REBASE_AGENT_ID]).toBeUndefined();
    expect(wasDiscarded).toBe(true);
  });

  it('discards the copy and leaves the job stopped', async () => {
    await store.getState().discardHistoryChange(target);
    expect(wasDiscarded).toBe(true);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toMatchObject({
      phase: 'stopped',
      copyPath: null,
      stop: { review: null },
    });
    expect(store.getState().historyRewriters[A_REBASE_AGENT_ID]).toBeUndefined();
  });

  it('preserves the review on discard failure and retries the same copy', async () => {
    const run = store.getState().historyRuns[A_REBASE_MOUNT_ID];
    isDiscardFailed = true;
    await expect(store.getState().discardHistoryChange(target)).rejects.toThrow('locked');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBe(run);
    isDiscardFailed = false;
    await store.getState().discardHistoryChange(target);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.copyPath).toBeNull();
  });

  it('keeps the review when acceptance cannot revalidate the copy', async () => {
    const run = store.getState().historyRuns[A_REBASE_MOUNT_ID];
    stubStoryInvoke({
      ...invokeHandlers,
      history_rewriter_collect: () => {
        throw new Error('The copy expired');
      },
    });
    await expect(store.getState().acceptHistoryChange(target)).rejects.toThrow('expired');
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBe(run);
    expect(wasDiscarded).toBe(false);
    stubStoryInvoke(invokeHandlers);
    await store.getState().acceptHistoryChange(target);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('applied');
  });

  it('drops collection after a different job replaced the reviewed run', async () => {
    stubStoryInvoke({
      ...invokeHandlers,
      history_rewriter_collect: () => {
        store.setState({ historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'trying' }) } });
        return { ...check, head: 'new-head' };
      },
    });
    await store.getState().acceptHistoryChange(target);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('trying');
    expect(wasDiscarded).toBe(false);
  });

  it('ignores a late rewriter check after dismissal', async () => {
    stubStoryInvoke({
      ...invokeHandlers,
      history_rewriter_collect: () => {
        store.setState({ historyRuns: {} });
        return check;
      },
    });
    await store.getState().settleHistoryRewriter({
      sessionId: A_REBASE_SESSION_ID,
      agentId: A_REBASE_AGENT_ID,
      assistantText: '<<history-done head="copy-head">>',
      hasFailed: false,
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
  });
  it('does not clear a newer job after discarding the old copy', async () => {
    stubStoryInvoke({
      ...invokeHandlers,
      history_copy_discard: () => {
        store.setState({ historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'trying' }) } });
      },
    });
    await store.getState().discardHistoryChange(target);
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('trying');
    expect(store.getState().historyRewriters[A_REBASE_AGENT_ID]).toBeUndefined();
  });

  it('can undo the accepted change through its backup', async () => {
    await store.getState().acceptHistoryChange(target);
    stubStoryInvoke({
      ...invokeHandlers,
      worktree_status: () => ({ ...status, head: 'new-head' }),
      history_restore: () => ({
        kind: 'moved',
        head: 'old-head',
        backupRef: 'refs/goodboy/backup/2',
      }),
    });
    await store.getState().restoreHistory({
      ...target,
      backupRef: 'refs/goodboy/backup/1',
      shouldPush: false,
      identity,
      expectedHead: 'new-head',
    });
    expect(store.getState().historyRuns[A_REBASE_MOUNT_ID]?.phase).toBe('restored');
    expect(
      store
        .getState()
        .sessionEvents[A_REBASE_SESSION_ID]?.some((event) => event.kind === 'history_restored'),
    ).toBe(true);
  });
});
