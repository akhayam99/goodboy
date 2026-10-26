// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type GitRepoCheck, type IsoDateTime, type WorkspaceId } from '@goodboy/types';
import { aFolderSignals, aProject, aWorkspace } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { CreateWorkspaceWithFoldersParams } from '../../../../store/slices/workspaces/createWorkspaceWithFolders';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';
import {
  OPEN_WIZARD_EVENT,
  enterWizardStep,
  finishWizard,
  hydrateOnboardingFromDb,
  markStepComplete,
  pauseWizard,
} from '../../../onboarding/onboardingSettings';
import { WorkspaceLauncher } from './index';

const NOW = brandId<IsoDateTime>({ value: '2026-10-17T09:00:00.000Z' });

const workspaceNamed = (name: string) =>
  aWorkspace({
    id: brandId<WorkspaceId>({ value: `ws-${name.toLowerCase()}` }),
    name,
    lastAccessedAt: NOW,
  });

const HARBORLINE = workspaceNamed('Harborline');
const NORTHWIND = workspaceNamed('Northwind');

const HARBORLINE_FOLDERS = ['payments-api', 'ledger-core', 'notify-relay'].map((name) =>
  aProject({
    workspaceId: HARBORLINE.id,
    name,
    kind: 'repo',
    rootPath: `/mock/Code/harborline/${name}`,
  }),
);

const NOTES = '/mock/Code/acme-notes';

const NOTES_CHECK: GitRepoCheck = {
  isRepo: false,
  rootPath: null,
  resolvedPath: NOTES,
  defaultBranch: null,
  error: 'not a git repository',
  errorKind: 'not_a_repository',
};

let useAppStore: StoryStore;
const openWorkspace = vi.fn();
const disconnectWorkspace = vi.fn();
const saveSetting = vi.fn();
const createWorkspaceWithFolders = vi.fn();
const onNew = vi.fn();
const onOpenWizard = vi.fn();

type RenderParams = {
  readonly isCreating?: boolean;
  readonly onCloseCreate?: () => void;
};

const renderHome = ({ isCreating = false, onCloseCreate = vi.fn() }: RenderParams = {}) =>
  render(<WorkspaceLauncher isCreating={isCreating} onCloseCreate={onCloseCreate} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await hydrateOnboardingFromDb();
  dialog.picks = [];
  openWorkspace.mockReset().mockResolvedValue({ kind: 'here' });
  disconnectWorkspace.mockReset().mockResolvedValue(undefined);
  saveSetting.mockReset().mockResolvedValue(undefined);
  createWorkspaceWithFolders
    .mockReset()
    .mockImplementation(async ({ workspaceId, name }: CreateWorkspaceWithFoldersParams) => {
      const workspace = aWorkspace({ id: workspaceId, name });
      const projects = [aProject({ workspaceId, kind: 'folder', rootPath: NOTES })];
      useAppStore.setState((state) => ({
        workspaces: [workspace, ...state.workspaces],
        projects: [...projects, ...state.projects],
      }));
      return { workspace, projects, movedSessionCount: 0 };
    });
  stubStoryInvoke({
    validate_git_repo: NOTES_CHECK,
    scan_child_repos: [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    read_folder_signals: aFolderSignals({ path: NOTES, counts: { markdown: 12 } }),
  });
  useAppStore.setState({
    workspaces: [HARBORLINE, NORTHWIND],
    projects: HARBORLINE_FOLDERS,
    openWorkspace,
    disconnectWorkspace,
    saveSetting,
    createWorkspaceWithFolders,
  });
  onNew.mockReset();
  onOpenWizard.mockReset();
  window.addEventListener('goodboy:add-workspace', onNew);
  window.addEventListener(OPEN_WIZARD_EVENT, onOpenWizard);
});

afterEach(() => {
  window.removeEventListener('goodboy:add-workspace', onNew);
  window.removeEventListener(OPEN_WIZARD_EVENT, onOpenWizard);
  cleanup();
});

describe('Home', () => {
  it('carries the lockup: the brand tile, the word and the version', () => {
    renderHome();

    const heading = screen.getByRole('heading', { level: 1, name: 'Goodboy' });
    const lockup = heading.closest('main');
    expect(lockup?.querySelector('[data-brand-tile]')).not.toBeNull();
    expect(screen.getByText(/^v\d/)).toBeDefined();
  });

  it('lists each workspace with its folder count and its folder, never a project', async () => {
    renderHome();

    expect(await screen.findByText('3 folders · ~/Code/harborline')).toBeDefined();
    expect(screen.queryByText(/project/i)).toBeNull();
  });

  it('says the face of a one folder workspace instead of 1 folder', async () => {
    const acmeNotes = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
    const acmeWeb = aWorkspace({ name: 'Acme web', slug: 'acme-web' });
    const notes = aProject({
      workspaceId: acmeNotes.id,
      name: 'acme-notes',
      kind: 'folder',
      rootPath: '/mock/Documents/acme-notes',
    });
    const web = aProject({
      workspaceId: acmeWeb.id,
      name: 'acme-web',
      kind: 'folder',
      rootPath: '/mock/Code/acme-web',
    });
    useAppStore.setState({
      workspaces: [HARBORLINE, acmeNotes, acmeWeb],
      projects: [...HARBORLINE_FOLDERS, notes, web],
      folderPurpose: { [notes.id]: 'documents', [web.id]: 'code' },
    });
    renderHome();

    expect(await screen.findByText('Documents · ~/Documents/acme-notes')).toBeDefined();
    expect(screen.getByText('Code, no git yet · ~/Code/acme-web')).toBeDefined();
    expect(screen.getByText('3 folders · ~/Code/harborline')).toBeDefined();
  });

  it('says how many sessions need you in a workspace and why, before you open it', async () => {
    act(() => {
      useAppStore.setState({
        attentionFromDatabase: {
          [NORTHWIND.id]: {
            count: 2,
            tone: 'danger',
            reasonWords: ['Checks failing', '1 question for you'],
          },
        },
      });
    });
    const { container } = renderHome();

    await screen.findByRole('button', { name: 'Open Northwind, 2 need you' });
    const row = container.querySelector('[data-workspace-row="Northwind"]');
    expect(row?.textContent).toContain('2 need you');
    expect(row?.textContent).toContain('Checks failing, 1 question for you');
    expect(
      container
        .querySelector('[data-workspace-row="Northwind"] [data-workspace-attention]')
        ?.getAttribute('data-workspace-attention'),
    ).toBe('danger');
    expect(
      container.querySelector('[data-workspace-row="Harborline"] [data-workspace-attention]'),
    ).toBeNull();
  });

  it('opens a workspace from its row', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open Harborline' }));

    expect(openWorkspace).toHaveBeenCalledWith({
      id: HARBORLINE.id,
      title: 'Harborline',
      onRunning: 'new-window',
    });
  });

  it('opens a workspace in a new window from its row', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open Northwind in a new window' }));

    expect(openWorkspace).toHaveBeenCalledWith({
      id: NORTHWIND.id,
      title: 'Northwind',
      target: 'new-window',
    });
  });

  it('disconnects a workspace only after the confirm, and Cancel keeps it', () => {
    renderHome();

    fireEvent.click(screen.getByLabelText('Disconnect Northwind'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(disconnectWorkspace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Disconnect Harborline'));
    const dialogNode = screen.getByRole('dialog', { name: 'Disconnect Harborline?' });
    fireEvent.click(within(dialogNode).getByRole('button', { name: 'Disconnect workspace' }));
    expect(disconnectWorkspace).toHaveBeenCalledWith(HARBORLINE.id);
    expect(openWorkspace).not.toHaveBeenCalled();
  });

  it('opens New workspace through the one door, from the button and from Cmd+N', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /^New workspace/ }));
    pressShortcut({ id: 'home.newWorkspace', target: document.body });

    expect(onNew).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Open a folder')).toBeNull();
    expect(screen.queryByText('Start a new project')).toBeNull();
  });

  it('swaps the list for the one form in place, and Cancel or Escape goes back', () => {
    const onCloseCreate = vi.fn();
    renderHome({ isCreating: true, onCloseCreate });

    expect(screen.getByRole('heading', { level: 1, name: 'Goodboy' })).toBeDefined();
    expect(screen.getByRole('form', { name: 'New workspace' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Workspaces' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onCloseCreate).toHaveBeenCalledTimes(2);
  });

  it('creates in place, closes the form for a plain code folder and asks nothing more', async () => {
    const onCloseCreate = vi.fn();
    renderHome({ isCreating: true, onCloseCreate });

    dialog.picks = [NOTES];
    fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
    await screen.findByRole('list', { name: 'Folders' });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => expect(onCloseCreate).toHaveBeenCalledOnce());
    expect(onOpenWizard).not.toHaveBeenCalled();
  });

  it('lands a documents workspace in the workspace, never on the git band', async () => {
    createWorkspaceWithFolders.mockImplementation(
      async ({ workspaceId, name }: CreateWorkspaceWithFoldersParams) => {
        const workspace = aWorkspace({ id: workspaceId, name });
        const notes = aProject({ workspaceId, kind: 'folder', rootPath: NOTES });
        useAppStore.setState((state) => ({
          workspaces: [workspace, ...state.workspaces],
          projects: [notes, ...state.projects],
          folderPurpose: { ...state.folderPurpose, [notes.id]: 'documents' },
        }));
        return { workspace, projects: [notes], movedSessionCount: 0 };
      },
    );
    const onCloseCreate = vi.fn();
    renderHome({ isCreating: true, onCloseCreate });

    dialog.picks = [NOTES];
    fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
    await screen.findByRole('list', { name: 'Folders' });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => expect(onCloseCreate).toHaveBeenCalledOnce());
  });

  it('shows the search field from five workspaces on, never with four', () => {
    const four = ['Acme', 'Cascadia', 'Harborline', 'Northwind'].map(workspaceNamed);
    useAppStore.setState({ workspaces: four });
    const { unmount } = renderHome();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByLabelText('Search workspaces or folders')).toBeNull();
    unmount();

    useAppStore.setState({ workspaces: [...four, workspaceNamed('Ledger')] });
    renderHome();
    fireEvent.change(screen.getByLabelText('Search workspaces or folders'), {
      target: { value: 'casc' },
    });

    expect(screen.getAllByRole('button', { name: /^Open [A-Z][a-z]+$/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open Cascadia' })).toBeDefined();
  });

  it('persists the reopen-last switch', () => {
    renderHome();

    fireEvent.click(screen.getByRole('switch', { name: 'Reopen the last workspace on launch' }));

    expect(saveSetting).toHaveBeenCalledWith(SETTING_REOPEN_LAST, '1');
  });

  it('shows the update action when an update is available, and hides it when current', () => {
    const { unmount } = renderHome();
    expect(screen.queryByTestId('update-pill')).toBeNull();
    unmount();

    useAppStore.setState({ updaterStatus: 'available', updateVersion: '0.27.9' });
    renderHome();

    expect(screen.getByRole('button', { name: 'Goodboy 0.27.9 is available' })).toBeDefined();
  });
});

describe('Home with no workspace yet', () => {
  beforeEach(() => {
    useAppStore.setState({ workspaces: [], projects: [] });
  });

  it('says so and offers Resume setup at the step setup paused on', async () => {
    markStepComplete('agents');
    await enterWizardStep({ step: 'workspace' });
    await act(async () => {
      await pauseWizard();
    });
    renderHome();

    expect(screen.getByRole('heading', { name: 'No workspace yet' })).toBeDefined();
    expect(screen.getByText('Setup paused at Workspace · 1 of 4 done')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Resume setup' }));

    expect(onOpenWizard).toHaveBeenCalledOnce();
    expect(onOpenWizard.mock.lastCall?.[0]).toMatchObject({
      detail: { mode: 'setup', step: 'workspace' },
    });
  });

  it('offers only New workspace once setup is done', async () => {
    await act(async () => {
      await finishWizard();
    });
    renderHome();

    expect(screen.queryByRole('button', { name: 'Resume setup' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
