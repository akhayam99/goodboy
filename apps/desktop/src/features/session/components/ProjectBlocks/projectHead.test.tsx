// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { AgentId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { brandedId } from '../../../history/testing/brandedId';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from '../SessionOverviewPane/CentralColumn';
import {
  buildStoryAgent,
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../plans/plans', async () =>
  (await import('../../../../store/storyHarness')).plansModuleMock(),
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

const BLOCKED = "You can't unmount a project while branches are attached. Close them first.";

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: () => ({ stdout: '', stderr: 'no remote', exitCode: 1 }),
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
  await useAppStore.getState().loadSessionMounts({ sessionId });
  const [mount] = useAppStore.getState().sessionMounts[sessionId] ?? [];
  useAppStore.setState({
    sessionPhaseRuns: {
      [sessionId]: [
        buildStoryAgent({
          id: brandedId<AgentId>({ value: 'agent-ledger-export' }),
          sessionId,
          name: 'Implementer',
          status: 'completed',
          ...(mount === undefined ? {} : { mountId: mount.id }),
        }),
      ],
    },
  });
});

afterEach(() => {
  cleanup();
});

const show = async () => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
          <CentralColumn session={session} />
        </WorkTimeProvider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

const headOf = (): HTMLElement => {
  const head = document.querySelector<HTMLElement>('[data-board-project-head]');
  if (head === null) {
    throw new Error('the project head must draw');
  }
  return head;
};

const attachedMounts = () =>
  (useAppStore.getState().sessionProjectMounts[sessionId] ?? []).filter(
    (mount) => mount.projectId === PROJECT_ID,
  );

const mountRows = () =>
  rowsOf<{ worktree_path: string | null; is_attached: number }>({
    sql: 'SELECT worktree_path, is_attached FROM session_worktrees WHERE session_id = ?',
    params: [sessionId],
  });

const openCloseConfirm = async (): Promise<HTMLElement> => {
  fireEvent.click(await screen.findByRole('button', { name: /goodboy\/ledger-export actions$/ }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Close branch' }));
  return screen.findByRole('group', { name: /^Close the branch for / });
};

describe('the project head', () => {
  it('puts New branch right of the worktrees and left of Unmount', async () => {
    await show();
    const head = within(headOf());

    const worktrees = await head.findByRole('button', { name: /^Worktrees in ledger-core/ });
    const newBranch = head.getByRole('button', { name: 'New branch in ledger-core' });
    const unmount = head.getByRole('button', { name: 'Unmount ledger-core' });

    expect(
      worktrees.compareDocumentPosition(newBranch) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      newBranch.compareDocumentPosition(unmount) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('disables Unmount and says why while a branch is attached', async () => {
    await show();
    const unmount = within(headOf()).getByRole('button', { name: 'Unmount ledger-core' });

    expect(unmount.hasAttribute('disabled')).toBe(true);
    expect(unmount.getAttribute('aria-haspopup')).toBeNull();
    fireEvent.click(unmount);
    expect(screen.queryByRole('dialog', { name: 'Unmount ledger-core?' })).toBeNull();
    const anchor = unmount.parentElement;
    if (anchor === null) {
      throw new Error('the tooltip anchor must wrap the button');
    }
    fireEvent.mouseEnter(anchor);
    await screen.findByText(BLOCKED, {}, { timeout: 2000 });
  });

  it('enables Unmount once no branch is attached', async () => {
    useAppStore.setState({
      sessionProjectMounts: { ...useAppStore.getState().sessionProjectMounts, [sessionId]: [] },
    });
    await show();
    const unmount = within(headOf()).getByRole('button', { name: 'Unmount ledger-core' });

    expect(unmount.hasAttribute('disabled')).toBe(false);
    expect(unmount.getAttribute('aria-haspopup')).toBe('dialog');
  });
});

describe('Close branch on a tile', () => {
  it('does nothing on Cancel', async () => {
    await show();
    const confirm = within(await openCloseConfirm());

    fireEvent.click(confirm.getByRole('button', { name: 'Cancel' }));

    expect(attachedMounts()).toHaveLength(1);
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();
    expect(await mountRows()).toEqual([{ worktree_path: WORKTREE.worktreePath, is_attached: 1 }]);
  });

  it('detaches the branch and keeps its folder with Keep the folder', async () => {
    await show();
    const confirm = within(await openCloseConfirm());

    await act(async () => {
      fireEvent.click(confirm.getByRole('button', { name: 'Keep the folder' }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(attachedMounts()).toHaveLength(0));
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();
    expect(await mountRows()).toEqual([{ worktree_path: WORKTREE.worktreePath, is_attached: 0 }]);
  });

  it('detaches the branch and removes its folder with Remove the folder', async () => {
    await show();
    const confirm = within(await openCloseConfirm());

    await act(async () => {
      fireEvent.click(confirm.getByRole('button', { name: 'Remove the folder' }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(attachedMounts()).toHaveLength(0));
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: WORKTREE.worktreePath }),
    );
    expect(await mountRows()).toEqual([{ worktree_path: null, is_attached: 0 }]);
  });

  it('keeps the branch attached and shows why when git keeps the folder', async () => {
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('2 commits not pushed'));
    await show();
    const confirm = within(await openCloseConfirm());

    await act(async () => {
      fireEvent.click(confirm.getByRole('button', { name: 'Remove the folder' }));
      await Promise.resolve();
    });

    await screen.findByText(/The folder stayed: 2 commits not pushed/, {}, { timeout: 2000 });
    expect(attachedMounts()).toHaveLength(1);
    expect(await mountRows()).toEqual([{ worktree_path: WORKTREE.worktreePath, is_attached: 1 }]);
  });
});
