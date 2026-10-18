// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    updateProjectIdentity: vi.fn(async () => undefined),
  }),
);
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
const { dialog } = vi.hoisted(() => {
  const picks: Array<string | null> = [];
  return { dialog: { picks } };
});
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => dialog.picks.shift() ?? null),
}));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { CreateWorkspaceWithFoldersParams } from '../../../store/slices/workspaces/createWorkspaceWithFolders';
import { ProjectLinkList } from './index';

const NOTIFY_RELAY = '/mock/Code/northwind/notify-relay';
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });

let useAppStore: StoryStore;
const createWorkspaceWithFolders = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dialog.picks = [NOTIFY_RELAY];
  stubStoryInvoke({
    validate_git_repo: {
      isRepo: true,
      rootPath: NOTIFY_RELAY,
      resolvedPath: NOTIFY_RELAY,
      defaultBranch: 'develop',
      error: null,
      errorKind: null,
    },
    scan_child_repos: [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    project_git_status: {
      state: 'ready',
      branch: 'develop',
      headSubject: null,
      upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
      workingTree: { kind: 'unknown', reason: 'status-read-failed' },
      upstream: null,
      inProgress: null,
    },
  });
  createWorkspaceWithFolders
    .mockReset()
    .mockImplementation(async ({ workspaceId }: CreateWorkspaceWithFoldersParams) => {
      const project = aProject({ workspaceId, name: 'notify-relay', rootPath: NOTIFY_RELAY });
      useAppStore.setState((state) => ({ projects: [project, ...state.projects] }));
      return { workspace: NORTHWIND, projects: [project], movedSessionCount: 0 };
    });
  useAppStore.setState({ workspaces: [NORTHWIND], projects: [], createWorkspaceWithFolders });
});

afterEach(() => {
  cleanup();
});

describe('ProjectLinkList', () => {
  it('opens the one form in add mode for this workspace behind Add folder', () => {
    render(<ProjectLinkList workspaceId={NORTHWIND.id} emptyHint="No folders yet" />);

    expect(screen.queryByRole('form', { name: 'Add a folder' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));

    expect(screen.getByRole('form', { name: 'Add a folder' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start from scratch' })).toBeNull();
  });

  it('adds the picked folder to this workspace and closes the form once it lands', async () => {
    render(<ProjectLinkList workspaceId={NORTHWIND.id} emptyHint="No folders yet" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
    await screen.findByRole('list', { name: 'Folders' });

    fireEvent.click(screen.getByRole('button', { name: /^add 1 folder/i }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add a folder' })).toBeNull());
    expect(createWorkspaceWithFolders.mock.lastCall?.[0]).toMatchObject({
      workspaceId: NORTHWIND.id,
      folders: [{ kind: 'repository', rootPath: NOTIFY_RELAY, defaultBranch: 'develop' }],
    });
    expect(screen.getByText('notify-relay')).toBeDefined();
  });

  it('closes the form on Cancel without writing anything', () => {
    render(<ProjectLinkList workspaceId={NORTHWIND.id} emptyHint="No folders yet" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('form', { name: 'Add a folder' })).toBeNull();
    expect(createWorkspaceWithFolders).not.toHaveBeenCalled();
  });
});
