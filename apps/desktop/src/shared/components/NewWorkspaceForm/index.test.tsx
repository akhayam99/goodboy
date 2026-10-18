// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
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

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeProjectAdoption } from '@goodboy/db';
import type { FolderSignals, GitRepoCheck } from '@goodboy/types';
import { aFolderSignals, aProject, aWorkspace } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { SETTING_NEW_PROJECT_PARENT } from '../../../features/settings/settings';
import type { CreateWorkspaceWithFoldersParams } from '../../../store/slices/workspaces/createWorkspaceWithFolders';
import { NewWorkspaceForm } from './index';

const ACME_WEB = '/mock/Code/acme-web';
const HARBORLINE = '/mock/Code/harborline';
const DOCS = '/mock/Code/acme-docs';
const DENIED = '/mock/Documents/acme-web';
const SITE = '/mock/Code/acme-site';
const RESEARCH = '/mock/Documents/acme-research';
const NORTHWIND_ROOT = '/mock/Code/northwind';
const HANDBOOK = `${NORTHWIND_ROOT}/handbook`;
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });
const PAYMENTS = aProject({
  workspaceId: NORTHWIND.id,
  name: 'payments-api',
  rootPath: `${HARBORLINE}/payments-api`,
});

type RepoParams = {
  readonly path: string;
  readonly branch: string;
};

type PathParams = {
  readonly path: string;
};

const repoAt = ({ path, branch }: RepoParams): GitRepoCheck => ({
  isRepo: true,
  rootPath: path,
  resolvedPath: path,
  defaultBranch: branch,
  error: null,
  errorKind: null,
});

const plainAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: path,
  defaultBranch: null,
  error: 'not a git repository',
  errorKind: 'not_a_repository',
});

const CHECKS: Readonly<Record<string, GitRepoCheck>> = {
  [ACME_WEB]: repoAt({ path: ACME_WEB, branch: 'main' }),
  [HARBORLINE]: plainAt({ path: HARBORLINE }),
  [DOCS]: plainAt({ path: DOCS }),
  [SITE]: plainAt({ path: SITE }),
  [RESEARCH]: plainAt({ path: RESEARCH }),
  [HANDBOOK]: {
    isRepo: true,
    rootPath: NORTHWIND_ROOT,
    resolvedPath: HANDBOOK,
    defaultBranch: 'main',
    error: null,
    errorKind: null,
  },
  [DENIED]: {
    isRepo: false,
    rootPath: null,
    resolvedPath: DENIED,
    defaultBranch: null,
    error: 'Operation not permitted',
    errorKind: 'permission_denied',
  },
};

const CHILDREN: Readonly<Record<string, ReadonlyArray<unknown>>> = {
  [HARBORLINE]: [
    { name: 'payments-api', path: `${HARBORLINE}/payments-api`, defaultBranch: 'main' },
    { name: 'ledger-core', path: `${HARBORLINE}/ledger-core`, defaultBranch: 'main' },
    { name: 'notify-relay', path: `${HARBORLINE}/notify-relay`, defaultBranch: 'develop' },
  ],
};

const SIGNALS: Readonly<Record<string, FolderSignals>> = {
  [DOCS]: aFolderSignals({ path: DOCS, counts: { markdown: 86, pdf: 12 } }),
  [SITE]: aFolderSignals({ path: SITE, markers: ['package.json'], counts: { source: 214 } }),
  [RESEARCH]: aFolderSignals({
    path: RESEARCH,
    counts: { video: 520, pdf: 120 },
    totalBytes: 38 * 1024 * 1024 * 1024,
  }),
};

const FIRST_COMMIT_PLAN = {
  rootPath: SITE,
  start: 'no_git',
  branch: 'main',
  author: { name: 'Dana Reyes', email: 'dana@acme.test', isFallback: false },
  entries: [
    {
      key: 'src',
      kind: 'included',
      files: 214,
      sample: [],
      isLeftOut: false,
      canToggle: false,
      ignore: null,
    },
  ],
  hasIgnoreFile: false,
};

const pathOf = (args: unknown): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

let useAppStore: StoryStore;
const createWorkspaceWithFolders = vi.fn();
const openWorkspace = vi.fn();
const ensureFirstLapSession = vi.fn();
const addWorkspace = vi.fn();
const onCreated = vi.fn();
const onCancel = vi.fn();

const lastRequest = (): CreateWorkspaceWithFoldersParams =>
  createWorkspaceWithFolders.mock.lastCall?.[0];

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dialog.picks = [];
  stubStoryInvoke({
    validate_git_repo: (args: unknown) => CHECKS[pathOf(args)] ?? plainAt({ path: pathOf(args) }),
    scan_child_repos: (args: unknown) => CHILDREN[pathOf(args)] ?? [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    open_privacy_settings: null,
    read_folder_signals: (args: unknown) =>
      SIGNALS[pathOf(args)] ?? aFolderSignals({ path: pathOf(args) }),
    folder_git_first_commit_plan: FIRST_COMMIT_PLAN,
  });
  createWorkspaceWithFolders
    .mockReset()
    .mockImplementation(async ({ workspaceId, name }: CreateWorkspaceWithFoldersParams) => ({
      workspace: aWorkspace({ id: workspaceId, name }),
      projects: [aProject({ workspaceId, name: 'acme-api' })],
      movedSessionCount: 0,
    }));
  openWorkspace.mockReset().mockResolvedValue({ kind: 'here' });
  ensureFirstLapSession.mockReset().mockResolvedValue({ id: 'session-first-lap' });
  addWorkspace.mockReset().mockResolvedValue(NORTHWIND);
  onCreated.mockReset();
  onCancel.mockReset();
  useAppStore.setState({
    workspaces: [NORTHWIND],
    projects: [],
    createWorkspaceWithFolders,
    openWorkspace,
    ensureFirstLapSession,
    addWorkspace,
  });
});

afterEach(() => {
  cleanup();
});

const renderFirstRun = () =>
  render(<NewWorkspaceForm mode="first-run" onCreated={onCreated} onCancel={onCancel} />);

const chooseFolder = async ({ path }: PathParams) => {
  dialog.picks = [path];
  click(/choose folder/i);
  await screen.findByRole('list', { name: 'Folders' });
};

describe('NewWorkspaceForm', () => {
  it('opens on one drop area and one primary, Choose folder, inside its own form', () => {
    renderFirstRun();

    expect(screen.getByRole('heading', { name: 'Your first workspace' })).toBeDefined();
    expect(screen.getByRole('button', { name: /drop a folder here/i })).toBeDefined();
    const choose = screen.getByRole('button', { name: /choose folder/i });
    expect(choose.closest('[data-slot="form-actions"]')?.closest('form')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /create workspace/i })).toBeNull();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('shows a picked repository with Git and its default branch, named after the folder', async () => {
    renderFirstRun();
    await chooseFolder({ path: ACME_WEB });

    const row = within(screen.getByRole('list', { name: 'Folders' }));
    expect(row.getByText('acme-web')).toBeDefined();
    expect(row.getByText('~/Code/acme-web')).toBeDefined();
    expect(row.getByText('Git')).toBeDefined();
    expect(row.getByText('main')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Workspace name' })).toHaveProperty(
      'value',
      'Acme web',
    );
    expect(screen.getByText('1 folder')).toBeDefined();
  });

  it('creates the workspace on Create, with its name edited in place, and hands back its id', async () => {
    renderFirstRun();
    await chooseFolder({ path: ACME_WEB });
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace name' }), {
      target: { value: 'Acme storefront' },
    });

    click(/create workspace/i);

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(lastRequest()).toMatchObject({
      name: 'Acme storefront',
      folders: [{ kind: 'repository', rootPath: ACME_WEB, defaultBranch: 'main' }],
      moves: [],
    });
    expect(onCreated).toHaveBeenCalledWith({ workspaceId: lastRequest().workspaceId });
  });

  it('lists the repositories inside a folder, checked, and counts the ones that stay', async () => {
    renderFirstRun();
    await chooseFolder({ path: HARBORLINE });

    expect(screen.getByText('Found 3 repositories in harborline.')).toBeDefined();
    expect(screen.getByText('3 folders')).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include ledger-core' }));

    expect(screen.getByText('2 folders')).toBeDefined();
  });

  it('asks what a plain folder is for, preselects Documents and never says git', async () => {
    renderFirstRun();
    await chooseFolder({ path: DOCS });

    const row = within(screen.getByRole('list', { name: 'Folders' }));
    expect(row.getByText('Looks like documents: 86 Markdown files and 12 PDFs')).toBeDefined();
    const faces = row.getByRole('tablist', { name: 'What acme-docs is for' });
    expect(
      within(faces)
        .getByRole('tab', { name: /Documents/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(row.getAllByText('Documents')).toHaveLength(2);
    expect(row.queryByRole('checkbox')).toBeNull();
    const codeCard = within(faces).getByRole('tab', { name: /Code project/ });
    expect(row.queryAllByText(/\bgit\b/i).filter((node) => !codeCard.contains(node))).toEqual([]);
    expect(
      screen.getByText(
        'Agents edit files in place. Each turn is saved first, so you can restore it.',
      ),
    ).toBeDefined();
    click(/create workspace/i);

    await waitFor(() => expect(createWorkspaceWithFolders).toHaveBeenCalled());
    expect(lastRequest().folders).toEqual([
      { kind: 'plain', rootPath: DOCS, purpose: 'documents' },
    ]);
  });

  it('offers git to a code folder, unticked, and says how many files go in', async () => {
    renderFirstRun();
    await chooseFolder({ path: SITE });

    expect(screen.getByText('Looks like code: a package.json and 214 source files')).toBeDefined();
    expect(screen.getByText('No git yet')).toBeDefined();
    const track = screen.getByRole('checkbox', {
      name: 'Track it with git when the workspace is created',
    });
    expect(track).toHaveProperty('checked', false);
    fireEvent.click(track);

    expect(
      await screen.findByText(
        '214 files go in the first commit. Dependencies, build output and secrets stay out.',
      ),
    ).toBeDefined();
    click(/create workspace/i);
    await waitFor(() => expect(createWorkspaceWithFolders).toHaveBeenCalled());
    expect(lastRequest().folders).toEqual([{ kind: 'git-init', rootPath: SITE }]);
  });

  it('switches the face on the row and drops the git box for Documents', async () => {
    renderFirstRun();
    await chooseFolder({ path: SITE });

    fireEvent.click(screen.getByRole('tab', { name: /Documents/ }));

    expect(screen.queryByRole('checkbox', { name: /Track it with git/ })).toBeNull();
    expect(
      screen.getByText(
        'Agents edit Markdown and text files. Word, PDF, Pages and Keynote files stay read only.',
      ),
    ).toBeDefined();
  });

  it('asks the whole repository or only this folder for a folder inside a repository', async () => {
    renderFirstRun();
    await chooseFolder({ path: HANDBOOK });

    expect(screen.getByText('handbook is inside the git repository northwind.')).toBeDefined();
    const scope = screen.getByRole('tablist', { name: 'What agents work on in handbook' });
    expect(
      within(scope)
        .getByRole('tab', { name: /The whole repository/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(within(scope).getByRole('tab', { name: /Only this folder/ }));
    click(/create workspace/i);

    await waitFor(() => expect(createWorkspaceWithFolders).toHaveBeenCalled());
    expect(lastRequest()).toMatchObject({
      name: 'Handbook',
      folders: [{ kind: 'plain', rootPath: HANDBOOK, purpose: 'documents' }],
    });
  });

  it('says before Create what a very large folder keeps no versions of', async () => {
    renderFirstRun();
    await chooseFolder({ path: RESEARCH });

    expect(screen.getByText('Looks like documents: 640 files, most of them video')).toBeDefined();
    expect(screen.getByText('acme-research holds 38 GB, mostly video.')).toBeDefined();
    expect(screen.getByText(/Goodboy keeps versions of files under 15 MB/)).toBeDefined();
  });

  it('names why macOS refused a folder, keeps Create off and offers the three ways out', async () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
    renderFirstRun();
    await chooseFolder({ path: DENIED });

    expect(screen.getByText("Goodboy can't read ~/Documents/acme-web.")).toBeDefined();
    expect(screen.getByText('Allow access or choose another folder.')).toBeDefined();
    expect(screen.getByRole('button', { name: /create workspace/i })).toHaveProperty(
      'disabled',
      true,
    );
    click('Open Privacy settings');

    await waitFor(() =>
      expect(storySpies.tauriInvoke).toHaveBeenCalledWith('open_privacy_settings', {}),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose another folder' })).toBeDefined();
    userAgent.mockRestore();
  });

  it('moves a folder another workspace holds on Create, never on the click', async () => {
    useAppStore.setState({
      previewProjectAdoption: async ({ rootPath }) =>
        rootPath === PAYMENTS.rootPath
          ? { project: PAYMENTS, sourceWorkspace: NORTHWIND, sessionCount: 3, isShell: false }
          : null,
    });
    vi.mocked(describeProjectAdoption).mockResolvedValue({
      sourceWorkspaceId: NORTHWIND.id,
      sessionCount: 3,
      isShell: false,
    });
    const adoptProject = vi.fn();
    useAppStore.setState({ adoptProject });
    renderFirstRun();
    await chooseFolder({ path: HARBORLINE });

    expect(
      screen.getByText('payments-api is already in Northwind, with 3 sessions.'),
    ).toBeDefined();
    click('Move it here');

    expect(screen.getByText('payments-api moves to Harborline with its 3 sessions.')).toBeDefined();
    expect(adoptProject).not.toHaveBeenCalled();
    click('Undo');
    expect(
      screen.getByText('payments-api is already in Northwind, with 3 sessions.'),
    ).toBeDefined();
    click('Leave it out');
    expect(screen.queryByText('payments-api')).toBeNull();
    expect(screen.getByText('2 folders')).toBeDefined();
  });

  it('shows a failed Create under the actions, keeps the draft and reads Retry', async () => {
    createWorkspaceWithFolders.mockRejectedValueOnce(new Error('database is locked'));
    renderFirstRun();
    await chooseFolder({ path: ACME_WEB });

    click(/create workspace/i);

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('database is locked')).toBeDefined();
    expect(screen.getByRole('button', { name: /^retry/i })).toBeDefined();
    expect(screen.getByText('acme-web')).toBeDefined();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('starts from scratch and stays in setup', async () => {
    useAppStore.setState({ settings: { [SETTING_NEW_PROJECT_PARENT]: '/mock/Code' } });
    renderFirstRun();
    fireEvent.click(screen.getByRole('button', { name: 'Start from scratch' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Folder name' }), {
      target: { value: 'acme-api' },
    });

    expect(await screen.findByText('~/Code/acme-api')).toBeDefined();
    click(/create workspace/i);

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(lastRequest().folders).toEqual([
      { kind: 'scratch', parentPath: '/mock/Code', name: 'acme-api' },
    ]);
    expect(openWorkspace).not.toHaveBeenCalled();
    expect(ensureFirstLapSession).not.toHaveBeenCalled();
  });

  it('offers to reconnect a disconnected workspace found at the picked folder', async () => {
    useAppStore.setState({
      checkReconnectCandidate: async () => ({
        workspaceId: NORTHWIND.id,
        workspaceName: 'Northwind',
        disconnectedAt: NORTHWIND.createdAt,
        sessionCount: 4,
        moved: null,
      }),
    });
    renderFirstRun();
    await chooseFolder({ path: ACME_WEB });

    click('Reconnect Northwind');

    await waitFor(() => expect(addWorkspace).toHaveBeenCalledWith({ rootPath: ACME_WEB }));
    expect(onCreated).toHaveBeenCalledWith({ workspaceId: NORTHWIND.id });
    expect(createWorkspaceWithFolders).not.toHaveBeenCalled();
  });

  it('restores the name on Escape while it is being edited', async () => {
    renderFirstRun();
    await chooseFolder({ path: ACME_WEB });
    const name = screen.getByRole('textbox', { name: 'Workspace name' });
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Acme sto' } });

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(name).toHaveProperty('value', 'Acme web');
  });

  it('goes Back through its own action row', () => {
    renderFirstRun();

    click('Back');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('adds folders to the workspace it names, with no name to ask', async () => {
    render(<NewWorkspaceForm mode="add" workspaceId={NORTHWIND.id} onCreated={onCreated} />);
    expect(screen.queryByRole('button', { name: 'Start from scratch' })).toBeNull();
    await chooseFolder({ path: ACME_WEB });

    expect(screen.queryByRole('textbox', { name: 'Workspace name' })).toBeNull();
    click(/^add 1 folder/i);

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ workspaceId: NORTHWIND.id }));
    expect(lastRequest()).toMatchObject({ workspaceId: NORTHWIND.id, name: 'Northwind' });
  });
});
