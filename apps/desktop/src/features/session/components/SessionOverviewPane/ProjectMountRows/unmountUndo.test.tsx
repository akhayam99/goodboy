// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { brandedId } from '../../../../history/testing/brandedId';
import { MountActionsMenu } from './MountActionsMenu';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  storySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
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
vi.mock('../../../../worktree/worktree', async () => ({
  ...(await import('../../../../../store/storyHarness')).worktreeModuleMock(),
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
vi.mock('../../../../../shared/lib/repo', async () =>
  (await import('../../../../../store/storyHarness')).repoModuleMock(),
);
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

const WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/ledger-export',
  branchName: 'goodboy/ledger-export',
  slug: 'ledger-export',
  reused: false,
};

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
});

afterEach(() => {
  cleanup();
});

const projectMounts = () =>
  (useAppStore.getState().sessionMounts[sessionId] ?? []).filter(
    (mount) => mount.projectId === PROJECT_ID,
  );

const unmount = async () => {
  render(
    <ToastProvider>
      <MountActionsMenu
        sessionId={sessionId}
        projectId={PROJECT_ID}
        workspaceId={WORKSPACE_ID}
        projectName="ledger-core"
        worktreePath="/tmp/ledger-core"
      />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Unmount ledger-core' }));
  const dialog = await screen.findByRole('dialog', { name: 'Unmount ledger-core?' });
  const confirm = await within(dialog).findByRole('button', {
    name: 'Unmount and remove worktree',
  });
  await act(async () => {
    fireEvent.click(confirm);
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(projectMounts()).toHaveLength(0));
};

describe('Unmount from the project block', () => {
  it('unmounts, then Undo mounts the project again on its branch', async () => {
    expect(projectMounts()).toHaveLength(1);
    await unmount();

    screen.getByText('Unmounted ledger-core and removed its worktree.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(projectMounts()).toHaveLength(1));
    expect(projectMounts()[0]?.branch).toBe('goodboy/ledger-export');
  });

  it('mounts the original branch again while another repository stays mounted', async () => {
    const payments = buildStoryProject({
      id: brandedId<ProjectId>({ value: 'project-payments-api' }),
      workspaceId: WORKSPACE_ID,
      name: 'payments-api',
      rootPath: '/tmp/payments-api',
    });
    await insertProject({ db: storySqlite(), project: payments });
    useAppStore.setState((state) => ({ projects: [...state.projects, payments] }));
    storySpies.createWorktree.mockResolvedValueOnce({
      worktreePath: '/tmp/payments-api/.goodboy/worktrees/payments-refund',
      branchName: 'goodboy/payments-refund',
      slug: 'payments-refund',
      reused: false,
    });
    await useAppStore
      .getState()
      .ensureProjectMounted({ sessionId, projectId: payments.id, reason: 'refund flow' });
    await unmount();
    storySpies.createWorktree.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(projectMounts()).toHaveLength(1));
    expect(storySpies.createWorktree).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: '/tmp/ledger-core',
        existingBranch: 'goodboy/ledger-export',
      }),
    );
  });

  it('keeps the project unmounted and reports the error when Undo fails', async () => {
    await unmount();
    storySpies.createWorktree.mockRejectedValueOnce(
      new Error('the branch is checked out elsewhere'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications).toContainEqual(
        expect.objectContaining({ title: "Couldn't undo the operation" }),
      ),
    );
    expect(projectMounts()).toHaveLength(0);
  });
});
