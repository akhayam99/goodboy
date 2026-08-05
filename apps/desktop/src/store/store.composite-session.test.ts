import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  changeWorktreeBranch,
  removeSessionDirectory,
  removeWorktree,
  listWorktreesForSession,
  updateSessionWorktreeBranch,
  deleteSession,
  detectRepoSlug,
  gitPush,
  tauriGhRunner,
} = vi.hoisted(() => ({
  changeWorktreeBranch: vi.fn(async () => undefined),
  removeSessionDirectory: vi.fn(async () => undefined),
  removeWorktree: vi.fn(async () => undefined),
  listWorktreesForSession: vi.fn(async () => [
    {
      worktreePath: '/projects/composite/sessions/composite-task',
      branch: 'gb/api-task',
      parallelIndex: 0,
    },
    {
      worktreePath: '/repos/api/.goodboy/worktrees/composite-task',
      branch: 'gb/api-task',
      parallelIndex: 1,
      mountWorkspaceId: 'ws-api',
      mountName: 'api',
    },
    {
      worktreePath: '/repos/web/.goodboy/worktrees/composite-task',
      branch: 'gb/web-task',
      parallelIndex: 2,
      mountWorkspaceId: 'ws-web',
      mountName: 'web',
    },
  ]),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  detectRepoSlug: vi.fn(async () => 'acme/web'),
  gitPush: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  tauriGhRunner: {},
}));

vi.mock('@goodboy/db', () => ({
  listWorktreesForSession,
  updateSessionWorktreeBranch,
  deleteSession,
}));

vi.mock('@goodboy/core', () => ({
  detectRepoSlug,
  fetchLinkedIssues: vi.fn(async () => []),
  listPrsForBranch: vi.fn(async () => []),
}));

vi.mock('../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../features/worktree/worktree', () => ({
  changeWorktreeBranch,
  removeSessionDirectory,
  removeWorktree,
  invalidateLocalBranchesCache: vi.fn(),
}));

vi.mock('../features/chat/turn', () => ({ cancelTurn: vi.fn(async () => undefined) }));

vi.mock('../features/github/github', () => ({
  createTauriPrCacheStore: vi.fn(() => ({})),
  gitPush,
  tauriGhRunner,
}));

import { pushSessionBranch } from './slices/github/pushSessionBranch';
import { refreshSessionPr } from './slices/github/refreshSessionPr';
import { deleteTask } from './slices/sessions/deleteTask';
import { changeSessionBranch } from './slices/worktrees/changeSessionBranch';

const SESSION_ID = 'sess-1' as never;
const COMPOSITE_WORKSPACE_ID = 'ws-composite';
const API_WORKSPACE_ID = 'ws-api';
const WEB_WORKSPACE_ID = 'ws-web';
const COMPOSITE_ROOT = '/projects/composite';
const CONTAINER_PATH = '/projects/composite/sessions/composite-task';
const API_REPO_ROOT = '/repos/api';
const WEB_REPO_ROOT = '/repos/web';
const API_WORKTREE_PATH = '/repos/api/.goodboy/worktrees/composite-task';
const WEB_WORKTREE_PATH = '/repos/web/.goodboy/worktrees/composite-task';
const API_BRANCH = 'gb/api-task';
const WEB_BRANCH = 'gb/web-task';

type Store = {
  sessions: ReadonlyArray<{
    id: string;
    workspaceId: string;
    goal: string;
    state: { kind: string };
  }>;
  archivedSessions: Record<string, ReadonlyArray<unknown>>;
  workspaces: ReadonlyArray<{
    id: string;
    rootPath: string;
    kind: string;
    members: ReadonlyArray<{
      workspaceId: string;
      rootPath: string;
      mountName: string;
    }>;
  }>;
  sessionBranches: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionMounts: Record<
    string,
    ReadonlyArray<{
      workspaceId: string;
      mountName: string;
      repoRoot: string;
      worktreePath: string;
      branch: string;
    }>
  >;
  sessionActiveMount: Record<string, string>;
  sessionGithub: Record<string, unknown>;
  sessionGithubPrs: Record<string, ReadonlyArray<unknown>>;
  sessionSelectedPrNumber: Record<string, number | null>;
  sessionExternalTasks: Record<string, ReadonlyArray<{ readonly branch?: string }>>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  closeSessionTerminals: () => Promise<void>;
  emitNotification: () => void;
};

type MakeStoreParams = {
  readonly activeMount?: string;
};

const makeStore = ({ activeMount }: MakeStoreParams): Store => ({
  sessions: [
    {
      id: SESSION_ID,
      workspaceId: COMPOSITE_WORKSPACE_ID,
      goal: 'ship composite task',
      state: { kind: 'idle' },
    },
  ],
  archivedSessions: {},
  workspaces: [
    {
      id: COMPOSITE_WORKSPACE_ID,
      rootPath: COMPOSITE_ROOT,
      kind: 'composite',
      members: [
        { workspaceId: API_WORKSPACE_ID, rootPath: API_REPO_ROOT, mountName: 'api' },
        { workspaceId: WEB_WORKSPACE_ID, rootPath: WEB_REPO_ROOT, mountName: 'web' },
      ],
    },
  ],
  sessionBranches: { [SESSION_ID]: API_BRANCH },
  sessionWorktrees: {
    [SESSION_ID]: [CONTAINER_PATH, API_WORKTREE_PATH, WEB_WORKTREE_PATH],
  },
  sessionMounts: {
    [SESSION_ID]: [
      {
        workspaceId: API_WORKSPACE_ID,
        mountName: 'api',
        repoRoot: API_REPO_ROOT,
        worktreePath: API_WORKTREE_PATH,
        branch: API_BRANCH,
      },
      {
        workspaceId: WEB_WORKSPACE_ID,
        mountName: 'web',
        repoRoot: WEB_REPO_ROOT,
        worktreePath: WEB_WORKTREE_PATH,
        branch: WEB_BRANCH,
      },
    ],
  },
  sessionActiveMount: activeMount == null ? {} : { [SESSION_ID]: activeMount },
  sessionGithub: {},
  sessionGithubPrs: {},
  sessionSelectedPrNumber: {},
  sessionExternalTasks: {},
  sessionPhaseRuns: {},
  closeSessionTerminals: vi.fn(async () => undefined),
  emitNotification: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a composite workspace session', () => {
  it('pushes from the active mount worktree instead of the container directory', async () => {
    const store = makeStore({});

    await pushSessionBranch((() => store) as never, SESSION_ID);

    expect(gitPush).toHaveBeenCalledOnce();
    expect(gitPush).toHaveBeenCalledWith(
      API_WORKTREE_PATH,
      API_BRANCH,
      COMPOSITE_WORKSPACE_ID,
      API_WORKSPACE_ID,
    );
  });

  it('pushes from the second member worktree when it is the explicit active mount', async () => {
    const store = makeStore({ activeMount: WEB_WORKSPACE_ID });

    await pushSessionBranch((() => store) as never, SESSION_ID);

    expect(gitPush).toHaveBeenCalledOnce();
    expect(gitPush).toHaveBeenCalledWith(
      WEB_WORKTREE_PATH,
      WEB_BRANCH,
      COMPOSITE_WORKSPACE_ID,
      WEB_WORKSPACE_ID,
    );
  });

  it('resolves the pull request repo slug against the active member repo root', async () => {
    const store = makeStore({ activeMount: WEB_WORKSPACE_ID });

    await refreshSessionPr(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(detectRepoSlug).toHaveBeenCalledWith(
      tauriGhRunner,
      WEB_REPO_ROOT,
      COMPOSITE_WORKSPACE_ID,
      WEB_WORKSPACE_ID,
    );
  });

  it('changes the active member branch and updates its database row', async () => {
    const store = makeStore({ activeMount: WEB_WORKSPACE_ID });

    await changeSessionBranch(vi.fn(), (() => store) as never)(SESSION_ID, {
      branch: 'gb/web-next',
      createNew: false,
    });

    expect(changeWorktreeBranch).toHaveBeenCalledWith({
      repoPath: WEB_REPO_ROOT,
      worktreePath: WEB_WORKTREE_PATH,
      branch: 'gb/web-next',
      createNew: false,
    });
    expect(updateSessionWorktreeBranch).toHaveBeenCalledWith(
      expect.anything(),
      SESSION_ID,
      2,
      'gb/web-next',
    );
  });

  it('removes every member worktree from its repo and removes the container directory', async () => {
    const store = makeStore({ activeMount: WEB_WORKSPACE_ID });

    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(removeWorktree).toHaveBeenCalledTimes(2);
    expect(removeWorktree).toHaveBeenNthCalledWith(1, API_REPO_ROOT, API_WORKTREE_PATH);
    expect(removeWorktree).toHaveBeenNthCalledWith(2, WEB_REPO_ROOT, WEB_WORKTREE_PATH);
    expect(removeSessionDirectory).toHaveBeenCalledWith({
      basePath: COMPOSITE_ROOT,
      path: CONTAINER_PATH,
    });
    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it('keeps the container directory when a member worktree removal fails', async () => {
    const store = makeStore({ activeMount: WEB_WORKSPACE_ID });
    removeWorktree.mockRejectedValueOnce(new Error('member removal failed'));

    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(removeWorktree).toHaveBeenCalledTimes(2);
    expect(removeSessionDirectory).not.toHaveBeenCalled();
    expect(store.emitNotification).toHaveBeenCalled();
  });
});
