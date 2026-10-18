import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace, setSetting } from '@goodboy/db';
import { brandId, type FolderGitProbe, type ProjectId, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { folderGitChoiceKey } from './folderGitChoiceKey';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });
const WEB = brandId<ProjectId>({ value: 'project-acme-web' });
const WEB_PATH = '/work/acme/acme-web';

type TrackedParams = {
  readonly commitCount?: number;
};

const tracked = ({ commitCount = 3 }: TrackedParams = {}): FolderGitProbe => ({
  path: WEB_PATH,
  state: 'tracked',
  rootPath: WEB_PATH,
  branch: 'main',
  commitCount,
  remoteUrl: null,
});

type WriterParams = {
  readonly holder: string | null;
};

const writerAt = ({ holder }: WriterParams) => ({
  path: WEB_PATH,
  holder,
  token: null,
  runId: null,
  isGranted: false,
  hasExited: false,
  waiting: [],
});

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
};

const deferred = <Value>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

let useAppStore: StoryStore;

const storedKind = async (): Promise<string | null> =>
  (
    await rowsOf<{ readonly kind: string }>({
      sql: 'SELECT kind FROM projects WHERE id = ?',
      params: [WEB],
    })
  )[0]?.kind ?? null;

const kindInStore = (): string | null =>
  useAppStore.getState().projects.find((project) => project.id === WEB)?.kind ?? null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: ACME, name: 'Acme web', slug: 'acme-web' });
  const project = buildStoryProject({
    id: WEB,
    workspaceId: ACME,
    name: 'acme-web',
    rootPath: WEB_PATH,
    kind: 'folder',
  });
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  useAppStore.setState({ workspaces: [workspace], projects: [project] });
  storySpies.worktreeWriterStatus.mockImplementation(async () => writerAt({ holder: null }));
});

describe('probeFolderGit', () => {
  it('switches a code folder only between turns', async () => {
    stubStoryInvoke({ folder_git_probe: () => tracked() });
    useAppStore.setState({ folderPurpose: { [WEB]: 'code' } });
    storySpies.worktreeWriterStatus.mockImplementation(async () =>
      writerAt({ holder: 'agent-writing' }),
    );

    await useAppStore.getState().probeFolderGit({ projectId: WEB });

    expect(kindInStore()).toBe('folder');
    expect(await storedKind()).toBe('folder');
    expect(useAppStore.getState().folderGitNotice[WEB]).toBeUndefined();

    storySpies.worktreeWriterStatus.mockImplementation(async () => writerAt({ holder: null }));
    await useAppStore.getState().probeFolderGit({ projectId: WEB });

    expect(kindInStore()).toBe('repo');
    expect(await storedKind()).toBe('repo');
    expect(useAppStore.getState().folderGitNotice[WEB]).toMatchObject({
      kind: 'switched',
      commitCount: 3,
      branch: 'main',
    });
  });

  it('asks a documents folder once and keeps it in place', async () => {
    stubStoryInvoke({ folder_git_probe: () => tracked() });
    useAppStore.setState({ folderPurpose: { [WEB]: 'documents' } });

    await useAppStore.getState().probeFolderGit({ projectId: WEB });

    expect(kindInStore()).toBe('folder');
    expect(useAppStore.getState().folderGitNotice[WEB]?.kind).toBe('ask');

    await useAppStore.getState().keepFolderInPlace({ projectId: WEB });
    await useAppStore.getState().probeFolderGit({ projectId: WEB });

    expect(useAppStore.getState().folderGitNotice[WEB]).toBeUndefined();
    expect(useAppStore.getState().folderGitChoice[WEB]).toBe('in-place');
    expect(kindInStore()).toBe('folder');
  });

  it('drops a late probe for the same folder', async () => {
    const first = deferred<FolderGitProbe>();
    const answers = [first.promise, Promise.resolve(tracked({ commitCount: 5 }))];
    stubStoryInvoke({ folder_git_probe: () => answers.shift() });
    useAppStore.setState({ folderPurpose: { [WEB]: 'documents' } });

    const late = useAppStore.getState().probeFolderGit({ projectId: WEB });
    await useAppStore.getState().probeFolderGit({ projectId: WEB });
    first.resolve({ ...tracked({ commitCount: 1 }), state: 'none' });

    expect(await late).toBeNull();
    expect(useAppStore.getState().folderGit[WEB]?.commitCount).toBe(5);
  });

  it('keeps editing in place after a switch, and the next probe leaves it alone', async () => {
    stubStoryInvoke({ folder_git_probe: () => tracked() });
    useAppStore.setState({ folderPurpose: { [WEB]: 'code' } });
    await useAppStore.getState().probeFolderGit({ projectId: WEB });
    expect(kindInStore()).toBe('repo');

    await useAppStore.getState().keepFolderInPlace({ projectId: WEB });
    await useAppStore.getState().probeFolderGit({ projectId: WEB });

    expect(kindInStore()).toBe('folder');
    expect(await storedKind()).toBe('folder');
    const choice = await rowsOf<{ readonly value: string }>({
      sql: 'SELECT value FROM settings WHERE key = ?',
      params: [folderGitChoiceKey({ projectId: WEB })],
    });
    expect(choice[0]?.value).toBe('in-place');
  });

  it('switches to the repository a documents folder sits in when asked', async () => {
    stubStoryInvoke({
      folder_git_probe: () => ({
        ...tracked(),
        state: 'above',
        rootPath: '/work/acme',
        commitCount: 0,
      }),
      validate_git_repo: () => ({ isRepo: true, rootPath: '/work/acme', defaultBranch: 'main' }),
    });
    useAppStore.setState({ folderPurpose: { [WEB]: 'documents' } });
    await setSetting(storySqlite(), folderGitChoiceKey({ projectId: WEB }), 'in-place');

    await useAppStore.getState().probeFolderGit({ projectId: WEB });
    await useAppStore.getState().switchFolderToRepo({ projectId: WEB });

    const project = useAppStore.getState().projects.find((candidate) => candidate.id === WEB);
    expect(project?.kind).toBe('repo');
    expect(project?.rootPath).toBe('/work/acme');
    expect(useAppStore.getState().folderPurpose[WEB]).toBe('code');
    expect(useAppStore.getState().folderGitChoice[WEB]).toBeUndefined();
  });
});
