// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { brandedId } from '../../../../history/testing/brandedId';
import { MountProjectAction } from './MountProjectAction';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';

beforeAll(async () => {
  await import('./MountProjectList');
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => '/tmp/acme-docs') }));
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../../chat/turn', async () =>
  (await import('../../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../../permissions/permissions', async () =>
  (await import('../../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../providers/providers', async () =>
  (await import('../../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../providers/routing', async () =>
  (await import('../../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../budget/budget', async () =>
  (await import('../../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../worktree/worktree', async () =>
  (await import('../../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../../shared/lib/repo', async () => ({
  ...(await import('../../../../../store/storyHarness')).repoModuleMock(),
  validateGitRepo: vi.fn(async () => ({
    isRepo: true,
    rootPath: '/tmp/acme-docs',
    resolvedPath: '/tmp/acme-docs',
    defaultBranch: 'main',
    error: null,
    errorKind: null,
  })),
  scanChildRepos: vi.fn(async () => []),
}));
vi.mock('../../../../plans/plans', async () =>
  (await import('../../../../../store/storyHarness')).plansModuleMock(),
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
  storySpies.createWorktree.mockResolvedValue({
    worktreePath: '/tmp/acme-docs/.goodboy/worktrees/ledger-export',
    branchName: 'goodboy/ledger-export',
    slug: 'ledger-export',
    reused: false,
  });
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
    goal: 'Reconcile the ledger export',
  });
  sessionId = session.id;
});

afterEach(() => {
  cleanup();
});

const acmeDocs = () =>
  useAppStore.getState().projects.find((candidate) => candidate.name === 'acme-docs');

const mountsOf = ({ projectId }: { readonly projectId: ProjectId | undefined }) =>
  (useAppStore.getState().sessionProjectMounts[sessionId] ?? []).filter(
    (mount) => mount.projectId === projectId,
  );

const chooseFolder = async () => {
  render(
    <ToastProvider>
      <MountProjectAction sessionId={sessionId} workspaceId={WORKSPACE_ID} presentation="button" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mount a folder' }));
  const picker = within(await screen.findByRole('dialog', { name: 'Mount a folder' }));
  await picker.findByRole('button', { name: 'Mount ledger-core' });
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Choose a folder…' }));
  });

  await vi.waitFor(() => expect(mountsOf({ projectId: acmeDocs()?.id })).toHaveLength(1));
};

describe('Mount a folder', () => {
  it('adds a chosen folder to the workspace and mounts it in one step, and Undo takes back both', async () => {
    await chooseFolder();
    expect(acmeDocs()?.workspaceId).toBe(WORKSPACE_ID);
    expect(screen.queryByRole('region', { name: 'Mount acme-docs' })).toBeNull();
    const addedId = acmeDocs()?.id;

    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });

    expect(mountsOf({ projectId: addedId })).toHaveLength(0);
    expect(acmeDocs()).toBeUndefined();
  });

  it('keeps the folder mounted and in the workspace when Undo cannot remove the worktree', async () => {
    await chooseFolder();
    storySpies.removeWorktreeChecked.mockRejectedValueOnce(new Error('git worktree remove failed'));

    let isUndone = true;
    await act(async () => {
      isUndone = await useAppStore.getState().undoLastOperation();
    });

    expect(isUndone).toBe(false);
    expect(mountsOf({ projectId: acmeDocs()?.id })).toHaveLength(1);
  });
});
