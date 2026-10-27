import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type FirstCommit,
  type ProjectId,
  type WorkspaceGitStatus,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

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

const FIRST_COMMIT: FirstCommit = {
  rootPath: WEB_PATH,
  branch: 'main',
  commit: 'a1b2c3d',
  files: 215,
};

const UNBORN: WorkspaceGitStatus = {
  state: 'unborn',
  branch: 'main',
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
};

let useAppStore: StoryStore;

const invoked = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const storedKind = async (): Promise<string | null> =>
  (
    await rowsOf<{ readonly kind: string }>({
      sql: 'SELECT kind FROM projects WHERE id = ?',
      params: [WEB],
    })
  )[0]?.kind ?? null;

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
});

describe('convertProjectToRepo', () => {
  it('tracks a plain folder with git without a remote', async () => {
    stubStoryInvoke({
      folder_git_make_first_commit: () => FIRST_COMMIT,
      validate_git_repo: () => ({ isRepo: true, rootPath: WEB_PATH, defaultBranch: 'main' }),
    });

    const converted = await useAppStore
      .getState()
      .convertProjectToRepo({ projectId: WEB, include: ['node_modules/'] });

    expect(converted.commit.files).toBe(215);
    expect(converted.project.kind).toBe('repo');
    expect(useAppStore.getState().projects[0]?.kind).toBe('repo');
    expect(await storedKind()).toBe('repo');
    expect(invoked('folder_git_make_first_commit')).toEqual([
      { args: { path: WEB_PATH, include: ['node_modules/'] } },
    ]);
    expect(invoked('repo_init_with_remote')).toEqual([]);
    expect(invoked('project_link_remote')).toEqual([]);
    expect(storySpies.releaseWriteSet).toHaveBeenCalledTimes(1);
  });

  it('waits for the session writing in the folder and names it', async () => {
    const session = aSession({ workspaceId: ACME, goal: 'Tighten the intro' });
    const writer = anAgent({ sessionId: session.id });
    useAppStore.setState({
      sessions: [session],
      sessionPhaseRuns: { [session.id]: [writer] },
    });
    storySpies.acquireWriteSet.mockImplementation(async () => ({
      isGranted: false,
      entries: [],
      blockedPath: WEB_PATH,
      blockedBy: writer.id,
    }));
    stubStoryInvoke({ folder_git_make_first_commit: () => FIRST_COMMIT });

    await expect(
      useAppStore.getState().convertProjectToRepo({ projectId: WEB, include: [] }),
    ).rejects.toThrow('Tighten the intro is writing in acme-web');

    expect(invoked('folder_git_make_first_commit')).toEqual([]);
    expect(useAppStore.getState().projects[0]?.kind).toBe('folder');
  });

  it('keeps the folder plain and hands it back when the first commit fails', async () => {
    stubStoryInvoke({
      folder_git_make_first_commit: () => {
        throw new Error('git failed: open("src/locked.ts"): Permission denied');
      },
    });

    await expect(
      useAppStore.getState().convertProjectToRepo({ projectId: WEB, include: [] }),
    ).rejects.toThrow('Permission denied');

    expect(useAppStore.getState().projects[0]?.kind).toBe('folder');
    expect(await storedKind()).toBe('folder');
    expect(storySpies.releaseWriteSet).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and tracks the folder', async () => {
    let attempts = 0;
    stubStoryInvoke({
      folder_git_make_first_commit: () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('git failed: index.lock exists');
        }
        return FIRST_COMMIT;
      },
      validate_git_repo: () => ({ isRepo: true, rootPath: WEB_PATH, defaultBranch: 'main' }),
    });

    await expect(
      useAppStore.getState().convertProjectToRepo({ projectId: WEB, include: [] }),
    ).rejects.toThrow('index.lock');
    await useAppStore.getState().convertProjectToRepo({ projectId: WEB, include: [] });

    expect(useAppStore.getState().projects[0]?.kind).toBe('repo');
  });

  it('makes the first commit of a repository with none and leaves it a repo', async () => {
    const repo = buildStoryProject({
      id: WEB,
      workspaceId: ACME,
      name: 'acme-web',
      rootPath: WEB_PATH,
      kind: 'repo',
    });
    const loadProjectGitStatus = vi.fn(async () => undefined);
    useAppStore.setState({
      projects: [repo],
      projectGitStatus: { [WEB]: UNBORN },
      loadProjectGitStatus,
    });
    stubStoryInvoke({ folder_git_make_first_commit: () => FIRST_COMMIT });

    const converted = await useAppStore
      .getState()
      .convertProjectToRepo({ projectId: WEB, include: [] });

    expect(converted.commit.files).toBe(215);
    expect(invoked('folder_git_make_first_commit')).toEqual([
      { args: { path: WEB_PATH, include: [] } },
    ]);
    expect(loadProjectGitStatus).toHaveBeenCalledWith({ projectId: WEB });
    expect(useAppStore.getState().projects[0]?.kind).toBe('repo');
    expect(storySpies.releaseWriteSet).toHaveBeenCalledTimes(1);
  });

  it('refuses a repository that already has a commit', async () => {
    const repo = buildStoryProject({
      id: WEB,
      workspaceId: ACME,
      name: 'acme-web',
      rootPath: WEB_PATH,
      kind: 'repo',
    });
    useAppStore.setState({
      projects: [repo],
      projectGitStatus: { [WEB]: { ...UNBORN, state: 'ready' } },
    });
    stubStoryInvoke({ folder_git_make_first_commit: () => FIRST_COMMIT });

    await expect(
      useAppStore.getState().convertProjectToRepo({ projectId: WEB, include: [] }),
    ).rejects.toThrow('acme-web is already tracked with git');

    expect(invoked('folder_git_make_first_commit')).toEqual([]);
  });
});
