// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../lib/db', async () =>
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

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { countRunningAdoptionAgents, describeProjectAdoption } from '@goodboy/db';
import type { GitRepoCheck, WorkspaceId } from '@goodboy/types';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_NEW_PROJECT_PARENT } from '../../../../features/settings/settings';
import type { CreateWorkspaceWithFoldersParams } from '../../../../store/slices/workspaces/createWorkspaceWithFolders';
import type { NewWorkspaceMode } from '../newWorkspaceMode';
import { useWorkspaceDraft, type DraftStart } from './index';

const ACME_WEB = '/mock/Code/acme-web';
const HARBORLINE = '/mock/Code/harborline';
const DOCS = '/mock/Code/acme-docs';
const DENIED = '/mock/Documents/acme-web';
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });
const PAYMENTS = aProject({
  workspaceId: NORTHWIND.id,
  name: 'payments-api',
  rootPath: `${HARBORLINE}/payments-api`,
});

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

type RepoParams = {
  readonly path: string;
  readonly branch: string;
};

type PathParams = {
  readonly path: string;
};

const repoAt = ({ path, branch }: RepoParams) =>
  ({
    isRepo: true,
    rootPath: path,
    resolvedPath: path,
    defaultBranch: branch,
    error: null,
    errorKind: null,
  }) satisfies GitRepoCheck;

const plainAt = ({ path }: PathParams) =>
  ({
    isRepo: false,
    rootPath: null,
    resolvedPath: path,
    defaultBranch: null,
    error: 'not a git repository',
    errorKind: 'not_a_repository',
  }) satisfies GitRepoCheck;

const CHECKS: Readonly<Record<string, GitRepoCheck>> = {
  [ACME_WEB]: repoAt({ path: ACME_WEB, branch: 'main' }),
  [HARBORLINE]: plainAt({ path: HARBORLINE }),
  [`${HARBORLINE}/payments-api`]: repoAt({ path: `${HARBORLINE}/payments-api`, branch: 'main' }),
  [`${HARBORLINE}/ledger-core`]: repoAt({ path: `${HARBORLINE}/ledger-core`, branch: 'main' }),
  [`${HARBORLINE}/notify-relay`]: repoAt({
    path: `${HARBORLINE}/notify-relay`,
    branch: 'develop',
  }),
  [DOCS]: plainAt({ path: DOCS }),
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

let useAppStore: StoryStore;
const createWorkspaceWithFolders = vi.fn();
const openWorkspace = vi.fn();
const ensureFirstLapSession = vi.fn();
const onCreated = vi.fn();

const pathOf = (args: unknown): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

const stubFolders = (overrides: Readonly<Record<string, unknown>> = {}) =>
  stubStoryInvoke({
    validate_git_repo: (args: unknown) => CHECKS[pathOf(args)] ?? plainAt({ path: pathOf(args) }),
    scan_child_repos: (args: unknown) => CHILDREN[pathOf(args)] ?? [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    ...overrides,
  });

const lastRequest = (): CreateWorkspaceWithFoldersParams =>
  createWorkspaceWithFolders.mock.lastCall?.[0];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dialog.picks = [];
  stubFolders();
  createWorkspaceWithFolders
    .mockReset()
    .mockImplementation(async ({ workspaceId, name }: CreateWorkspaceWithFoldersParams) => ({
      workspace: aWorkspace({ id: workspaceId, name }),
      projects: [aProject({ workspaceId, name: 'acme-api' })],
      movedSessionCount: 0,
    }));
  openWorkspace.mockReset().mockResolvedValue({ kind: 'here' });
  ensureFirstLapSession.mockReset().mockResolvedValue({ id: 'session-first-lap' });
  onCreated.mockReset();
  useAppStore.setState({
    workspaces: [NORTHWIND],
    projects: [],
    createWorkspaceWithFolders,
    openWorkspace,
    ensureFirstLapSession,
  });
});

afterEach(() => {
  cleanup();
});

type HookParams = {
  readonly mode?: NewWorkspaceMode;
  readonly start?: DraftStart;
};

const draftHook = ({ mode = 'first-run', start = 'folder' }: HookParams = {}) =>
  renderHook(() => useWorkspaceDraft({ mode, start, onCreated }));

describe('useWorkspaceDraft', () => {
  it('reads a picked repository into the draft and writes nothing before Create', async () => {
    dialog.picks = [ACME_WEB];
    const { result } = draftHook();

    await act(() => result.current.choose());

    expect(result.current.stage).toBe('folders');
    expect(result.current.folders).toMatchObject([
      { kind: 'repository', path: ACME_WEB, defaultBranch: 'main', isIncluded: true },
    ]);
    expect(result.current.name).toBe('Acme web');
    expect(result.current.sourceName).toBe('acme-web');
    expect(createWorkspaceWithFolders).not.toHaveBeenCalled();
    expect(useAppStore.getState().workspaces).toEqual([NORTHWIND]);
  });

  it('names the workspace after the picked folder, never its parent', async () => {
    dialog.picks = [HARBORLINE];
    const { result } = draftHook();

    await act(() => result.current.choose());

    expect(result.current.name).toBe('Harborline');
    expect(result.current.found).toEqual({ parentName: 'harborline', repositoryCount: 3 });
  });

  it('lists the repositories inside a folder checked, and sends only the ones left checked', async () => {
    dialog.picks = [HARBORLINE];
    const { result } = draftHook();
    await act(() => result.current.choose());

    act(() => result.current.toggle({ path: `${HARBORLINE}/ledger-core` }));
    expect(result.current.folderCount).toBe(2);
    await act(() => result.current.create());

    expect(lastRequest().folders).toEqual([
      { kind: 'repository', rootPath: `${HARBORLINE}/payments-api`, defaultBranch: 'main' },
      { kind: 'repository', rootPath: `${HARBORLINE}/notify-relay`, defaultBranch: 'develop' },
    ]);
    expect(lastRequest().name).toBe('Harborline');
  });

  it('drops a late result for an older pick', async () => {
    const slow = deferred<GitRepoCheck>();
    stubFolders({
      validate_git_repo: (args: unknown) =>
        pathOf(args) === DOCS ? slow.promise : (CHECKS[pathOf(args)] ?? null),
    });
    dialog.picks = [DOCS, ACME_WEB];
    const { result } = draftHook();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.choose();
    });
    await act(() => result.current.choose());
    slow.resolve(CHECKS[DOCS] ?? plainAt({ path: DOCS }));
    await act(() => first);

    expect(result.current.folders.map((folder) => folder.path)).toEqual([ACME_WEB]);
    expect(result.current.name).toBe('Acme web');
  });

  it('offers git init on a plain folder and sends it only when checked', async () => {
    dialog.picks = [DOCS];
    const { result } = draftHook();
    await act(() => result.current.choose());

    expect(result.current.folders).toMatchObject([{ kind: 'plain', isGitInit: false }]);
    act(() => result.current.setGitInit({ path: DOCS, isGitInit: true }));
    await act(() => result.current.create());

    expect(lastRequest().folders).toEqual([{ kind: 'git-init', rootPath: DOCS }]);
  });

  it('keeps Create off for a folder macOS refused and re-reads the same path on Try again', async () => {
    dialog.picks = [DENIED];
    const { result } = draftHook();
    await act(() => result.current.choose());

    expect(result.current.folders).toMatchObject([
      { kind: 'unreadable', problem: 'permission_denied' },
    ]);
    expect(result.current.block).toBe('Allow access or choose another folder.');
    stubFolders({ validate_git_repo: repoAt({ path: DENIED, branch: 'main' }) });
    const pick = result.current.folders[0]?.pick ?? 0;
    await act(() => result.current.retry({ pick, path: DENIED }));

    expect(result.current.folders).toMatchObject([{ kind: 'repository', path: DENIED }]);
    expect(result.current.block).toBeNull();
  });

  it('asks before moving a folder another workspace holds, and moves it only on Create', async () => {
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
    dialog.picks = [HARBORLINE];
    const { result } = draftHook();
    await act(() => result.current.choose());

    expect(result.current.block).toBe('Move payments-api here or leave it out.');
    act(() => result.current.decide({ path: PAYMENTS.rootPath, choice: 'move' }));
    await act(() => result.current.create());

    expect(lastRequest().moves).toEqual([
      { projectId: PAYMENTS.id, fromWorkspaceId: NORTHWIND.id },
    ]);
    expect(lastRequest().folders.map((folder) => folder.kind)).toEqual([
      'repository',
      'repository',
    ]);
  });

  it('refuses the move while agents run in the other workspace, and Leave it out drops the row', async () => {
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
    vi.mocked(countRunningAdoptionAgents).mockResolvedValue(2);
    dialog.picks = [HARBORLINE];
    const { result } = draftHook();
    await act(() => result.current.choose());

    expect(result.current.folders[0]).toMatchObject({ conflict: { runningAgentCount: 2 } });
    act(() => result.current.leave({ path: PAYMENTS.rootPath }));

    expect(result.current.folderCount).toBe(2);
    expect(result.current.block).toBeNull();
    vi.mocked(countRunningAdoptionAgents).mockResolvedValue(0);
  });

  it('creates once with the draft workspace id, and Retry reuses it after a failure', async () => {
    createWorkspaceWithFolders.mockRejectedValueOnce(new Error('database is locked'));
    dialog.picks = [ACME_WEB];
    const { result } = draftHook();
    await act(() => result.current.choose());

    await act(() => result.current.create());
    expect(result.current.error).toContain('database is locked');
    expect(onCreated).not.toHaveBeenCalled();
    const firstId: WorkspaceId = lastRequest().workspaceId;
    await act(() => result.current.create());

    expect(createWorkspaceWithFolders).toHaveBeenCalledTimes(2);
    expect(lastRequest().workspaceId).toBe(firstId);
    expect(onCreated).toHaveBeenCalledWith({ workspaceId: firstId });
    expect(result.current.error).toBeNull();
  });

  it('keeps Create off until the scratch folder name is usable, and says what is wrong', async () => {
    const { result } = draftHook({ start: 'scratch' });
    await waitFor(() => expect(result.current.scratch.parent).toBe('/mock'));

    expect(result.current.block).toBe('Name the new folder.');
    act(() => result.current.scratch.setName('.hidden'));
    expect(result.current.scratch.nameProblem).toBe('Start the name with a letter or a number');
    act(() => result.current.scratch.setName('acme-api'));

    expect(result.current.block).toBeNull();
    expect(result.current.name).toBe('Acme api');
  });

  it('starts from scratch in setup: creates the folder, remembers the place and stays in setup', async () => {
    useAppStore.setState({ settings: { [SETTING_NEW_PROJECT_PARENT]: '/mock/Code' } });
    const { result } = draftHook({ start: 'scratch' });
    act(() => result.current.scratch.setName('acme-api'));

    await act(() => result.current.create());

    expect(lastRequest().folders).toEqual([
      { kind: 'scratch', parentPath: '/mock/Code', name: 'acme-api' },
    ]);
    expect(useAppStore.getState().settings[SETTING_NEW_PROJECT_PARENT]).toBe('/mock/Code');
    expect(onCreated).toHaveBeenCalledOnce();
    expect(openWorkspace).not.toHaveBeenCalled();
    expect(ensureFirstLapSession).not.toHaveBeenCalled();
  });

  it('opens the new workspace and its first session when started from scratch outside setup', async () => {
    useAppStore.setState({ settings: { [SETTING_NEW_PROJECT_PARENT]: '/mock/Code' } });
    const { result } = draftHook({ mode: 'new', start: 'scratch' });
    act(() => result.current.scratch.setName('acme-api'));

    await act(() => result.current.create());

    expect(openWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Acme api', onRunning: 'new-window' }),
    );
    expect(ensureFirstLapSession).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('adds folders to the workspace it names, under that workspace name', async () => {
    dialog.picks = [ACME_WEB];
    const { result } = renderHook(() =>
      useWorkspaceDraft({ mode: 'add', workspaceId: NORTHWIND.id, onCreated }),
    );
    await act(() => result.current.choose());

    await act(() => result.current.create());

    expect(lastRequest()).toMatchObject({ workspaceId: NORTHWIND.id, name: 'Northwind' });
    expect(onCreated).toHaveBeenCalledWith({ workspaceId: NORTHWIND.id });
  });

  it('removing the last folder goes back to the empty step', async () => {
    dialog.picks = [ACME_WEB];
    const { result } = draftHook();
    await act(() => result.current.choose());

    act(() => result.current.remove({ path: ACME_WEB }));

    expect(result.current.stage).toBe('empty');
    expect(result.current.folderCount).toBe(0);
  });
});
