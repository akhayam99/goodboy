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
import { SessionContextCards } from '../../../../app/components/SessionContextCards';
import { CentralColumn } from '../SessionOverviewPane/CentralColumn';
import { PROJECT_DETACH_EVENT, projectKeyOf } from '../../../actions/kinds/project';
import { BoardProjectRemovals } from './BoardProjectRemovals';
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
  storySqlite,
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
vi.mock('../../../worktree/worktree', async () => ({
  ...(await import('../../../../store/storyHarness')).worktreeModuleMock(),
  worktreeDetachAssessment: async ({ worktreePath }: { readonly worktreePath: string }) => ({
    kind: 'assessed',
    path: worktreePath,
    branch: 'goodboy/ledger-export',
    hasUpstream: true,
    affectedFiles: 0,
    localOnlyCommits: 0,
    ignoredFiles: 0,
    ignoredFileSamples: [],
    integration: { kind: 'merged', base: 'origin/main' },
  }),
}));
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

const QUESTION = 'Remove ledger-core from the session?';

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

const mountRows = () =>
  rowsOf<{ worktree_path: string | null }>({
    sql: 'SELECT worktree_path FROM session_worktrees WHERE session_id = ?',
    params: [sessionId],
  });

const projectMounts = () =>
  (useAppStore.getState().sessionMounts[sessionId] ?? []).filter(
    (mount) => mount.projectId === PROJECT_ID,
  );

const show = async () => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
          <SessionContextCards session={session} />
          <CentralColumn session={session} />
        </WorkTimeProvider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

const chooseFromProjectMenu = async () => {
  const row = document.querySelector<HTMLElement>(
    '[data-card-project="ledger-core"] [data-project-row]',
  );
  if (row === null) {
    throw new Error('the Context card must list the project');
  }
  fireEvent.contextMenu(row);
  fireEvent.click(await screen.findByRole('menuitem', { name: /Remove from session/ }));
};

const confirmRemoval = async () => {
  const dialog = await screen.findByRole('dialog', { name: QUESTION });
  const remove = await within(dialog).findByRole('button', { name: 'Remove and delete worktree' });
  await act(async () => {
    fireEvent.click(remove);
    await Promise.resolve();
  });
};

describe('the project block on the Overview', () => {
  it('opens the removal question when the verb is chosen from the project menu, and the project leaves', async () => {
    expect(projectMounts()).toHaveLength(1);
    await show();

    await chooseFromProjectMenu();
    expect(screen.getAllByRole('dialog', { name: QUESTION })).toHaveLength(1);
    await confirmRemoval();

    await vi.waitFor(() => expect(projectMounts()).toHaveLength(0));
    expect(await mountRows()).toEqual([]);
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: WORKTREE.worktreePath }),
    );
    expect(screen.queryByRole('dialog', { name: QUESTION })).toBeNull();
  });

  it('keeps the project and says why when git refuses the removal', async () => {
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('git worktree remove failed'));
    await show();

    await chooseFromProjectMenu();
    await confirmRemoval();

    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications).toContainEqual(
        expect.objectContaining({
          title: "Couldn't remove ledger-core from the session",
          body: expect.stringContaining('git worktree remove failed'),
        }),
      ),
    );
    expect(projectMounts()).toHaveLength(1);
    expect(await mountRows()).toEqual([{ worktree_path: WORKTREE.worktreePath }]);
    screen.getByRole('dialog', { name: QUESTION });
  });
});

const FORK_ID = brandedId<ProjectId>({ value: 'project-ledger-core-fork' });
const FORK_WORKTREE = {
  worktreePath: '/tmp/ledger-core-fork/.goodboy/worktrees/ledger-export',
  branchName: 'goodboy/ledger-export-fork',
  slug: 'ledger-export-fork',
  reused: false,
};

const showRemovals = () => {
  render(
    <ToastProvider>
      <BoardProjectRemovals sessionId={sessionId} />
    </ToastProvider>,
  );
};

const requestDetach = ({ projectId }: { readonly projectId: ProjectId }) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(PROJECT_DETACH_EVENT, {
        detail: { projectKey: projectKeyOf({ sessionId, projectId }) },
      }),
    );
  });
};

describe('the board removal owner', () => {
  it('answers a request with no project head on screen', async () => {
    showRemovals();

    requestDetach({ projectId: PROJECT_ID });

    await screen.findByRole('dialog', { name: QUESTION });
  });

  it('answers a request for a project whose worktrees are all closed', async () => {
    useAppStore.setState({
      sessionProjectMounts: { ...useAppStore.getState().sessionProjectMounts, [sessionId]: [] },
    });
    showRemovals();

    requestDetach({ projectId: PROJECT_ID });

    await screen.findByRole('dialog', { name: QUESTION });
  });

  it('removes the worktrees of the project asked for when two projects share a name', async () => {
    const fork = buildStoryProject({
      id: FORK_ID,
      workspaceId: WORKSPACE_ID,
      name: 'ledger-core',
      rootPath: '/tmp/ledger-core-fork',
    });
    await insertProject({ db: storySqlite(), project: fork });
    useAppStore.setState({ projects: [project, fork] });
    storySpies.createWorktree.mockResolvedValueOnce(FORK_WORKTREE);
    await useAppStore.getState().ensureProjectMounted({
      sessionId,
      projectId: FORK_ID,
      reason: 'Compare the forked ledger',
    });
    showRemovals();

    requestDetach({ projectId: FORK_ID });
    await confirmRemoval();

    await vi.waitFor(() =>
      expect(
        (useAppStore.getState().sessionMounts[sessionId] ?? []).map((mount) => mount.projectId),
      ).toEqual([PROJECT_ID]),
    );
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: FORK_WORKTREE.worktreePath }),
    );
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: WORKTREE.worktreePath }),
    );
  });
});
