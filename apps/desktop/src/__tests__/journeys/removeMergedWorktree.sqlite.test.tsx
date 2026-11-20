// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  type RenderResult,
} from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type {
  IsoDateTime,
  MountCleanupProposal,
  ProjectId,
  SessionId,
  SessionMountView,
  WorkspaceId,
} from '@goodboy/types';
import { ToastProvider } from '../../shared/components/Toast';
import { brandedId } from '../../features/history/testing/brandedId';
import { resetWorktreeStatusCache } from '../../store/runtime/worktreeStatuses/cache';
import { actionRetryOf } from '../../store/slices/notifications/actionRetries';
import { CentralColumn } from '../../features/session/components/SessionOverviewPane/CentralColumn';
import { deleteMergedBranches } from '../../features/session/components/BranchBoard/deleteMergedBranches';
import { WorkTimeProvider } from '../../features/workTreeModel/WorkTimeProvider';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () => ({
  ...(await import('../../store/storyHarness')).worktreeModuleMock(),
  branchMergeState: async () => ({ kind: 'merged-via-pr' }),
}));
vi.mock('../../shared/lib/repo', async () => ({
  ...(await import('../../store/storyHarness')).repoModuleMock(),
  projectFetch: async () => undefined,
}));
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

const WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/ledger-export',
  branchName: 'goodboy/ledger-export',
  slug: 'ledger-export',
  reused: false,
};

const RELAY_WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/notify-relay',
  branchName: 'goodboy/notify-relay',
  slug: 'notify-relay',
  reused: false,
};

let useAppStore: StoryStore;
let sessionId: SessionId;
let prState: 'OPEN' | 'MERGED';
let branchDeletes = 0;
const refusedRestores = new Set<string>();
const restoredBranches: Array<string> = [];

const proposalOf = ({ mount }: { readonly mount: SessionMountView }): MountCleanupProposal => ({
  requestId: `request-${mount.id}`,
  sessionId,
  mountId: mount.id,
  projectId: mount.projectId,
  reason: 'merge_cleanup',
  repoRoot: mount.repoRoot,
  worktreePath: mount.worktreePath ?? '',
  branch: mount.branch,
  sizeBytes: null,
  request: null,
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-16T09:30:00.000Z' }),
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const rawPr = () => ({
  number: 418,
  title: 'Reconcile the ledger export',
  url: 'https://github.com/harborline/ledger-core/pull/418',
  state: prState,
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: WORKTREE.branchName,
  reviewDecision: 'APPROVED',
  statusCheckRollup: [],
  updatedAt: '2026-10-16T09:00:00Z',
  body: '',
  autoMergeRequest: null,
  headRefOid: 'abc1234',
  mergedAt: prState === 'MERGED' ? '2026-10-16T09:30:00Z' : null,
  author: { login: 'mara' },
});

type GhPayload = { readonly args: ReadonlyArray<string> };

beforeEach(async () => {
  await resetStoryStore();
  prState = 'OPEN';
  branchDeletes = 0;
  refusedRestores.clear();
  restoredBranches.length = 0;
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    branch_head_sha: 'abc1234',
    get_workspace_overrides: { afterMerge: 'ask' },
    branch_delete_checked: () => {
      branchDeletes += 1;
      return {
        keepRef: 'refs/goodboy/kept/ledger-export',
        deletedOnOrigin: false,
        originError: null,
      };
    },
    branch_restore: ({ args }: { readonly args: { readonly branch: string } }) => {
      if (refusedRestores.has(args.branch)) {
        throw new Error(`git refused to restore ${args.branch}`);
      }
      restoredBranches.push(args.branch);
      return { restored: true };
    },
    gh_run: (payload: GhPayload) => {
      if (payload.args[0] === 'repo') {
        return { stdout: 'harborline/ledger-core', stderr: '', exitCode: 0 };
      }
      if (payload.args[0] === 'pr' && payload.args[1] === 'list') {
        return { stdout: JSON.stringify([rawPr()]), stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: 'not stubbed', exitCode: 1 };
    },
  });
  storySpies.createWorktree.mockResolvedValue(WORKTREE);
  storySpies.worktreeStatus.mockRejectedValue(new Error('git status is not available'));
  resetWorktreeStatusCache();
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    goal: 'Reconcile the ledger export',
  });
  sessionId = session.id;
});

afterEach(() => {
  cleanup();
});

const showNext = (view: RenderResult): string => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  view.rerender(
    <ToastProvider>
      <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
        <CentralColumn session={session} />
      </WorkTimeProvider>
    </ToastProvider>,
  );
  return nextCardOf(view)?.textContent ?? '';
};

const nextCardOf = (view: RenderResult): HTMLElement | null =>
  view.container.querySelector<HTMLElement>('[data-slot="branch-board-section"]');

const nextCard = (view: RenderResult): HTMLElement => {
  const card = nextCardOf(view);
  if (card === null) {
    throw new Error('the Next card is not drawn');
  }
  return card;
};

const mountRows = () =>
  rowsOf<{ worktree_path: string | null; is_attached: number; disk_state: string }>({
    sql: 'SELECT worktree_path, is_attached, disk_state FROM session_worktrees WHERE session_id = ?',
    params: [sessionId],
  });

const operationRows = () =>
  rowsOf<{ kind: string; status: string }>({
    sql: 'SELECT kind, status FROM mount_operations WHERE session_id = ? ORDER BY created_at, rowid',
    params: [sessionId],
  });

const detachEvents = async () =>
  (
    await rowsOf<{ payload_json: string }>({
      sql: "SELECT payload_json FROM session_events WHERE session_id = ? AND kind = 'project_detached'",
      params: [sessionId],
    })
  ).map((row) => JSON.parse(row.payload_json));

const mountOf = () => {
  const [mount] = useAppStore.getState().sessionMounts[sessionId] ?? [];
  if (mount === undefined) {
    throw new Error('the session has no mount');
  }
  return mount;
};

const REMOVE_NOTE = 'Delete local branch · 1.0 KB';

const mergeThePr = async (view: RenderResult) => {
  await useAppStore.getState().loadSessionMounts({ sessionId });
  await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
  expect(showNext(view)).not.toContain(REMOVE_NOTE);
  prState = 'MERGED';
  await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
  await vi.waitFor(() => expect(showNext(view)).toContain(REMOVE_NOTE));
};

const clickLastButton = ({ name }: { readonly name: string }) => {
  const last = screen.getAllByRole('button', { name }).at(-1);
  if (last === undefined) {
    throw new Error(`no ${name} button`);
  }
  fireEvent.click(last);
};

const confirmRemoval = (view: RenderResult) => {
  fireEvent.click(
    within(nextCard(view)).getByRole('button', { name: /^Delete local branch · 1\.0 KB/ }),
  );
  clickLastButton({ name: 'Delete local branch' });
};

describe('journey: delete the local branch of a merged pull request from the board', () => {
  it('offers the delete once the pull request merges, and deletes folder and branch on confirm', async () => {
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await useAppStore.getState().loadSessionMounts({ sessionId });
    expect(await mountRows()).toEqual([
      { worktree_path: WORKTREE.worktreePath, is_attached: 1, disk_state: 'unchecked' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: true, worktreePath: WORKTREE.worktreePath });

    await mergeThePr(view);

    const card = showNext(view);
    expect(card).toContain('#418');
    expect(card).toContain(REMOVE_NOTE);
    expect(useAppStore.getState().mountCleanupProposals[sessionId]).toHaveLength(1);
    expect(await operationRows()).toEqual([{ kind: 'remove', status: 'pending' }]);
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();

    fireEvent.click(
      within(nextCard(view)).getByRole('button', { name: /^Delete local branch · 1\.0 KB/ }),
    );
    expect(screen.getByText('Delete local branch?')).toBeDefined();
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();
    clickLastButton({ name: 'Delete local branch' });

    await vi.waitFor(() =>
      expect(useAppStore.getState().mountCleanupProposals[sessionId]).toEqual([]),
    );
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ worktreePath: WORKTREE.worktreePath }),
    );
    expect(branchDeletes).toBe(1);
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: false, worktreePath: null });
    expect(await detachEvents()).toEqual([
      expect.objectContaining({ branch: WORKTREE.branchName, kept: false }),
    ]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(showNext(view)).not.toContain(REMOVE_NOTE);
  });

  it('keeps the mount and the card when git refuses a removal from the mount row, and a retry removes it', async () => {
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await mergeThePr(view);
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('git worktree remove failed'));

    const refused = await useAppStore.getState().removeMountWorktree({
      sessionId,
      mountId: mountOf().id,
      mode: 'safe',
    });

    expect(refused).toEqual({ kind: 'failed', reason: 'git worktree remove failed' });
    expect(await mountRows()).toEqual([
      { worktree_path: WORKTREE.worktreePath, is_attached: 1, disk_state: 'unchecked' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: true, worktreePath: WORKTREE.worktreePath });
    expect(await operationRows()).toEqual([
      { kind: 'remove', status: 'pending' },
      { kind: 'remove', status: 'failed' },
    ]);
    expect(showNext(view)).toContain(REMOVE_NOTE);

    confirmRemoval(view);

    await vi.waitFor(() =>
      expect(useAppStore.getState().mountCleanupProposals[sessionId]).toEqual([]),
    );
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledTimes(2);
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(showNext(view)).not.toContain(REMOVE_NOTE);
  });

  it('keeps the board as it was when git refuses, logs one row, and its Retry deletes', async () => {
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await mergeThePr(view);
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('git worktree remove failed'));

    confirmRemoval(view);

    await vi.waitFor(() =>
      expect(
        useAppStore
          .getState()
          .notifications.find((row) => row.title.startsWith("Couldn't delete the local branch")),
      ).toBeDefined(),
    );
    const failure = useAppStore
      .getState()
      .notifications.find((row) => row.title.startsWith("Couldn't delete the local branch"));
    expect(failure?.title).toBe(`Couldn't delete the local branch ${WORKTREE.branchName}`);
    expect(failure?.action?.kind).toBe('retry-action');
    expect(within(nextCard(view)).queryByRole('alert')).toBeNull();
    expect(useAppStore.getState().mountCleanupProposals[sessionId]).toHaveLength(1);
    expect(await mountRows()).toEqual([
      { worktree_path: WORKTREE.worktreePath, is_attached: 1, disk_state: 'unchecked' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: true, worktreePath: WORKTREE.worktreePath });
    expect(branchDeletes).toBe(0);

    const retry =
      failure?.action?.kind === 'retry-action'
        ? actionRetryOf({ retryId: failure.action.retryId })
        : undefined;
    expect(await retry?.()).toBe(true);

    expect(useAppStore.getState().mountCleanupProposals[sessionId]).toEqual([]);
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledTimes(2);
    expect(branchDeletes).toBe(1);
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(showNext(view)).not.toContain(REMOVE_NOTE);
  });

  it('brings every branch of a grouped delete back with one Undo, and a second Undo finishes an interrupted one', async () => {
    storySpies.createWorktree.mockImplementation(
      async ({ branchName }: { readonly branchName: string }) =>
        branchName === RELAY_WORKTREE.branchName ? RELAY_WORKTREE : WORKTREE,
    );
    await useAppStore.getState().loadSessionMounts({ sessionId });
    await useAppStore.getState().forkMount({
      sessionId,
      projectId: PROJECT_ID,
      branch: RELAY_WORKTREE.branchName,
    });
    const mounts = [...(useAppStore.getState().sessionMounts[sessionId] ?? [])].sort(
      (left, right) => left.branch.localeCompare(right.branch),
    );
    expect(mounts.map((mount) => mount.branch)).toEqual([
      WORKTREE.branchName,
      RELAY_WORKTREE.branchName,
    ]);

    expect(
      await deleteMergedBranches({
        sessionId,
        proposals: mounts.map((mount) => proposalOf({ mount })),
      }),
    ).toBe(true);

    expect(branchDeletes).toBe(2);
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);

    refusedRestores.add(RELAY_WORKTREE.branchName);
    expect(await useAppStore.getState().undoLastOperation()).toBe(false);

    expect(restoredBranches).toEqual([WORKTREE.branchName]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect((await mountRows()).map((row) => row.is_attached).sort()).toEqual([0, 1]);

    refusedRestores.clear();
    expect(await useAppStore.getState().undoLastOperation()).toBe(true);

    expect(restoredBranches).toEqual([WORKTREE.branchName, RELAY_WORKTREE.branchName]);
    expect(useAppStore.getState().undoStack).toEqual([]);
    expect((await mountRows()).map((row) => row.is_attached)).toEqual([1, 1]);
    expect(
      (useAppStore.getState().sessionMounts[sessionId] ?? []).every((mount) => mount.isAttached),
    ).toBe(true);
  });
});
