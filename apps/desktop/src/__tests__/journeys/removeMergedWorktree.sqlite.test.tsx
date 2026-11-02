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
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../shared/components/Toast';
import { brandedId } from '../../features/history/testing/brandedId';
import { resetWorktreeStatusCache } from '../../store/runtime/worktreeStatuses/cache';
import { CentralColumn } from '../../features/session/components/SessionOverviewPane/CentralColumn';
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
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
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

let useAppStore: StoryStore;
let sessionId: SessionId;
let prState: 'OPEN' | 'MERGED';

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
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
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
        <CentralColumn session={session} onLeadChange={() => undefined} />
      </WorkTimeProvider>
    </ToastProvider>,
  );
  return nextCardOf(view)?.textContent ?? '';
};

const nextCardOf = (view: RenderResult): HTMLElement | null =>
  view.container.querySelector<HTMLElement>('[data-overview-card="next"]');

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

const REMOVE_NOTE = 'Remove the ledger-core worktree';

const mergeThePr = async (view: RenderResult) => {
  await useAppStore.getState().loadSessionMounts({ sessionId });
  await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
  expect(showNext(view)).toBe('');
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
  fireEvent.click(within(nextCard(view)).getByRole('button', { name: /^Remove/ }));
  clickLastButton({ name: 'Remove' });
};

describe('journey: remove a merged worktree from the Next card', () => {
  it('offers the removal once the pull request merges, and removes the worktree on confirm', async () => {
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await useAppStore.getState().loadSessionMounts({ sessionId });
    expect(await mountRows()).toEqual([
      { worktree_path: WORKTREE.worktreePath, is_attached: 1, disk_state: 'unchecked' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: true, worktreePath: WORKTREE.worktreePath });

    await mergeThePr(view);

    const card = showNext(view);
    expect(card).toContain('#418 merged · 1.0 KB');
    expect(useAppStore.getState().mountCleanupProposals[sessionId]).toHaveLength(1);
    expect(await operationRows()).toEqual([{ kind: 'remove', status: 'pending' }]);
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();

    fireEvent.click(within(nextCard(view)).getByRole('button', { name: /^Remove/ }));
    expect(screen.getByText('Remove worktree?')).toBeDefined();
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();
    clickLastButton({ name: 'Remove' });

    await vi.waitFor(() =>
      expect(useAppStore.getState().mountCleanupProposals[sessionId]).toEqual([]),
    );
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledExactlyOnceWith({
      repoPath: '/tmp/ledger-core',
      worktreePath: WORKTREE.worktreePath,
      mode: 'safe',
    });
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: false, worktreePath: null });
    expect(await operationRows()).toEqual([
      { kind: 'remove', status: 'succeeded' },
      { kind: 'unmount', status: 'succeeded' },
    ]);
    expect(await detachEvents()).toEqual([
      expect.objectContaining({ branch: WORKTREE.branchName, kept: false }),
    ]);
    expect(showNext(view)).toBe('');
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
    expect(showNext(view)).toBe('');
  });

  it('keeps the card and the mount when git refuses the removal from the card, shows the error, and a retry removes it', async () => {
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await mergeThePr(view);
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('git worktree remove failed'));

    confirmRemoval(view);

    await vi.waitFor(() => {
      showNext(view);
      expect(within(nextCard(view)).getByRole('alert').textContent).toContain(
        'git worktree remove failed',
      );
    });
    expect(useAppStore.getState().mountCleanupProposals[sessionId]).toHaveLength(1);
    expect(await mountRows()).toEqual([
      { worktree_path: WORKTREE.worktreePath, is_attached: 1, disk_state: 'unchecked' },
    ]);
    expect(mountOf()).toMatchObject({ isAttached: true, worktreePath: WORKTREE.worktreePath });
    expect(await operationRows()).toEqual([
      { kind: 'remove', status: 'pending' },
      { kind: 'unmount', status: 'failed' },
    ]);
    expect(await detachEvents()).toEqual([]);
    expect(showNext(view)).toContain(REMOVE_NOTE);

    fireEvent.click(within(nextCard(view)).getByRole('button', { name: 'Retry Remove worktree' }));
    clickLastButton({ name: 'Retry' });

    await vi.waitFor(() =>
      expect(useAppStore.getState().mountCleanupProposals[sessionId]).toEqual([]),
    );
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledTimes(2);
    expect(await mountRows()).toEqual([
      { worktree_path: null, is_attached: 0, disk_state: 'removed' },
    ]);
    expect(await operationRows()).toEqual([
      { kind: 'remove', status: 'succeeded' },
      { kind: 'unmount', status: 'succeeded' },
    ]);
    expect(await detachEvents()).toEqual([
      expect.objectContaining({ branch: WORKTREE.branchName, kept: false }),
    ]);
    expect(showNext(view)).toBe('');
  });
});
