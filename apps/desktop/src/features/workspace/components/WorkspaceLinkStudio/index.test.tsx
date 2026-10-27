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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GitRepoCheck, Project } from '@goodboy/types';
import { aFolderSignals, aProject, aWorkspace } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { OPEN_WIZARD_EVENT } from '../../../onboarding/onboardingSettings';
import type { CreateWorkspaceWithFoldersParams } from '../../../../store/slices/workspaces/createWorkspaceWithFolders';
import { WorkspaceLinkStudio } from './index';

const ACME_WEB = '/mock/Code/acme-web';
const NOTES = '/mock/Code/acme-notes';
const SITE = '/mock/Code/acme-site';

const CHECKS: Readonly<Record<string, GitRepoCheck>> = {
  [ACME_WEB]: {
    isRepo: true,
    rootPath: ACME_WEB,
    resolvedPath: ACME_WEB,
    defaultBranch: 'main',
    error: null,
    errorKind: null,
  },
  [SITE]: {
    isRepo: false,
    rootPath: null,
    resolvedPath: SITE,
    defaultBranch: null,
    error: 'not a git repository',
    errorKind: 'not_a_repository',
  },
  [NOTES]: {
    isRepo: false,
    rootPath: null,
    resolvedPath: NOTES,
    defaultBranch: null,
    error: 'not a git repository',
    errorKind: 'not_a_repository',
  },
};

const pathOf = (args: unknown): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

let useAppStore: StoryStore;
const createWorkspaceWithFolders = vi.fn();
const openWorkspace = vi.fn();
const onOpenWizard = vi.fn();

type KindParams = {
  readonly folder: CreateWorkspaceWithFoldersParams['folders'][number];
};

type PathParams = {
  readonly path: string;
};

const kindOf = ({ folder }: KindParams): Project['kind'] =>
  folder.kind === 'plain' ? 'folder' : 'repo';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dialog.picks = [ACME_WEB];
  stubStoryInvoke({
    validate_git_repo: (args: unknown) => CHECKS[pathOf(args)] ?? null,
    scan_child_repos: [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    read_folder_signals: (args: unknown) =>
      pathOf(args) === SITE
        ? aFolderSignals({ path: SITE, markers: ['package.json'], counts: { source: 40 } })
        : aFolderSignals({ path: pathOf(args), counts: { markdown: 12 } }),
  });
  createWorkspaceWithFolders
    .mockReset()
    .mockImplementation(
      async ({ workspaceId, name, folders }: CreateWorkspaceWithFoldersParams) => {
        const workspace = aWorkspace({ id: workspaceId, name });
        const projects = folders.map((folder) =>
          aProject({
            workspaceId,
            kind: kindOf({ folder }),
            rootPath: 'rootPath' in folder ? folder.rootPath : folder.parentPath,
          }),
        );
        const purposes = Object.fromEntries(
          folders.flatMap((folder, index) => {
            const project = projects[index];
            return folder.kind === 'plain' && folder.purpose !== undefined && project !== undefined
              ? [[project.id, folder.purpose]]
              : [];
          }),
        );
        useAppStore.setState((state) => ({
          workspaces: [workspace, ...state.workspaces],
          projects: [...projects, ...state.projects],
          folderPurpose: { ...state.folderPurpose, ...purposes },
        }));
        return { workspace, projects, movedSessionCount: 0 };
      },
    );
  openWorkspace.mockReset().mockResolvedValue({ kind: 'here' });
  onOpenWizard.mockReset();
  useAppStore.setState({ workspaces: [], projects: [], createWorkspaceWithFolders, openWorkspace });
  window.addEventListener(OPEN_WIZARD_EVENT, onOpenWizard);
});

afterEach(() => {
  window.removeEventListener(OPEN_WIZARD_EVENT, onOpenWizard);
  cleanup();
});

const createFrom = async ({ path }: PathParams) => {
  dialog.picks = [path];
  fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
  await screen.findByRole('list', { name: 'Folders' });
  fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
};

describe('WorkspaceLinkStudio', () => {
  it('mounts the one form on a page surface titled New workspace, never a dialog', () => {
    const { container } = render(<WorkspaceLinkStudio onClose={vi.fn()} />);

    expect(screen.getByRole('banner', { name: 'New workspace' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'New workspace' })).toBeDefined();
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeDefined();
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('sits between the bars like every studio inside the shell', () => {
    const { container } = render(<WorkspaceLinkStudio onClose={vi.fn()} />);

    expect(container.firstElementChild?.className).not.toContain('inset-0');
  });

  it('closes the page on escape', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkStudio onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('creates the picked folder as a workspace, opens it and closes', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkStudio onClose={onClose} />);

    await createFrom({ path: ACME_WEB });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createWorkspaceWithFolders.mock.lastCall?.[0]).toMatchObject({ name: 'Acme web' });
    expect(openWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Acme web', onRunning: 'new-window' }),
    );
  });

  it('never opens setup, even when setup was never finished', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkStudio onClose={onClose} />);

    await createFrom({ path: ACME_WEB });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onOpenWizard).not.toHaveBeenCalled();
  });

  it('lands a plain code folder without git and asks nothing more, the pick row already offered git', async () => {
    const onClose = vi.fn();
    const openStudio = vi.fn();
    useAppStore.setState({ openStudio });
    render(<WorkspaceLinkStudio onClose={onClose} />);

    await createFrom({ path: SITE });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createWorkspaceWithFolders.mock.lastCall?.[0].folders).toEqual([
      { kind: 'plain', rootPath: SITE, purpose: 'code' },
    ]);
    expect(openStudio).not.toHaveBeenCalled();
  });

  it('opens a documents folder in its workspace', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkStudio onClose={onClose} />);

    await createFrom({ path: NOTES });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createWorkspaceWithFolders.mock.lastCall?.[0].folders).toEqual([
      { kind: 'plain', rootPath: NOTES, purpose: 'documents' },
    ]);
  });

  it('closes after a git folder lands', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkStudio onClose={onClose} />);

    await createFrom({ path: ACME_WEB });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
