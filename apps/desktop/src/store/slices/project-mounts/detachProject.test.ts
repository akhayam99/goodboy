import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  removeWorktree,
  worktreeStatus,
  deleteSessionWorktreeForProject,
  updateSessionActiveProject,
} = vi.hoisted(() => ({
  removeWorktree: vi.fn(async () => undefined),
  worktreeStatus: vi.fn(async () => ({
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  })),
  deleteSessionWorktreeForProject: vi.fn(async () => undefined),
  updateSessionActiveProject: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ deleteSessionWorktreeForProject, updateSessionActiveProject }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  removeWorktree,
  removeSessionDirectory: vi.fn(async () => undefined),
  worktreeStatus,
}));

import { detachProject } from './detachProject';

const SESSION_ID = 'sess-1' as never;
const PROJECT_ID = 'project-api' as never;

const makeStore = () => ({
  sessionProjectMounts: {
    'sess-1': [
      {
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: '/container/api',
        repoRoot: '/repos/api',
        branch: 'ak/feat',
      },
      {
        projectId: 'project-web',
        mountName: 'web',
        worktreePath: '/container/web',
        repoRoot: '/repos/web',
        branch: 'ak/feat',
      },
    ],
  },
  sessionWorktrees: { 'sess-1': ['/container', '/container/api', '/container/web'] },
  sessionWorktreeRecords: undefined,
  sessionActiveProject: { 'sess-1': 'project-api' },
  sessions: [{ id: 'sess-1', workspaceId: 'ws-1', activeProjectId: 'project-api' }],
  projects: [
    { id: 'project-api', workspaceId: 'ws-1', rootPath: '/repos/api', kind: 'repo', name: 'api' },
    { id: 'project-web', workspaceId: 'ws-1', rootPath: '/repos/web', kind: 'repo', name: 'web' },
  ],
  recordSessionEvent: vi.fn(async () => undefined),
});

type Store = ReturnType<typeof makeStore>;

const runDetach = async (store: Store) => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (s: Store) => object)(store) : updater;
    Object.assign(store, patch);
  });
  await detachProject(
    set as never,
    (() => store) as never,
  )({
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  worktreeStatus.mockResolvedValue({
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  });
});

describe('detachProject', () => {
  it('removes a clean worktree and records the detach with the project name', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(removeWorktree).toHaveBeenCalledWith('/repos/api', '/container/api');
    expect(deleteSessionWorktreeForProject).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
    });
    expect(store.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_detached',
      payload: expect.objectContaining({
        projectId: 'project-api',
        projectName: 'api',
        branch: 'ak/feat',
        kept: false,
      }),
    });
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual(['project-web']);
    expect(store.sessionWorktrees['sess-1']).toEqual(['/container', '/container/web']);
  });

  it('keeps a dirty worktree on disk and says so in the event', async () => {
    const store = makeStore();
    worktreeStatus.mockResolvedValue({
      workingTree: { kind: 'known', staged: 1, unstaged: 2, untracked: 0, unmerged: 0, changed: 3 },
    });

    await runDetach(store);

    expect(removeWorktree).not.toHaveBeenCalled();
    expect(store.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_detached',
      payload: expect.objectContaining({
        kept: true,
        reason: 'uncommitted changes in the worktree',
      }),
    });
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual(['project-web']);
  });

  it('treats an unreadable worktree as dirty', async () => {
    const store = makeStore();
    worktreeStatus.mockRejectedValue(new Error('not a git repository'));

    await runDetach(store);

    expect(removeWorktree).not.toHaveBeenCalled();
    expect(store.recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ kept: true }) }),
    );
  });

  it('hands the active project to the next remaining mount', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(updateSessionActiveProject).toHaveBeenCalledWith({
      db: {},
      id: SESSION_ID,
      projectId: 'project-web',
    });
    expect(store.sessionActiveProject['sess-1']).toBe('project-web');
  });

  it('refuses a project that is not mounted', async () => {
    const store = makeStore();
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (m) => m.projectId !== 'project-api',
    );

    await expect(runDetach(store)).rejects.toThrow('not mounted');
  });
});
