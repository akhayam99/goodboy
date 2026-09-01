import { beforeEach, describe, expect, it, vi } from 'vitest';

const order: Array<string> = [];

const {
  removeWorktree,
  listWorktreesForSession,
  deleteSession,
  deleteGithubPrCacheForWorktreePath,
} = vi.hoisted(() => ({
  removeWorktree: vi.fn(async () => undefined),
  listWorktreesForSession: vi.fn(async () => [
    {
      projectId: 'project-1',
      worktreePath: '/repo/.goodboy/worktrees/gb-ghost',
      branch: 'gb/ghost',
      parallelIndex: 0,
    },
  ]),
  deleteSession: vi.fn(async () => undefined),
  deleteGithubPrCacheForWorktreePath: vi.fn(async () => 1),
}));

vi.mock('@goodboy/db', () => ({
  listWorktreesForSession,
  deleteSession,
  deleteGithubPrCacheForWorktreePath,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  removeWorktree,
  removeSessionDirectory: vi.fn(async () => undefined),
  tidyRepoGoodboyDir: vi.fn(async () => undefined),
}));
vi.mock('../../../features/chat/turn', () => ({ cancelTurn: vi.fn(async () => undefined) }));

import { deleteTask } from './deleteTask';

const SESSION_ID = 'sess-1' as never;

const makeStore = () => ({
  sessions: [{ id: 'sess-1', workspaceId: 'ws-1', goal: 'ship it', state: { kind: 'idle' } }],
  archivedSessions: {},
  workspaces: [{ id: 'ws-1', sessionsRoot: '/repo' }],
  projects: [
    { id: 'project-1', workspaceId: 'ws-1', rootPath: '/repo', kind: 'repo', name: 'repo' },
  ],
  sessionBranches: { 'sess-1': 'gb/ghost' },
  sessionPhaseRuns: {},
  closeSessionTerminals: vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push('terminals closed');
  }),
  evictSession: vi.fn(),
  emitNotification: vi.fn(async () => undefined),
});

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
  removeWorktree.mockImplementation(async () => {
    order.push('worktree removed');
  });
});

describe('deleting a session', () => {
  it('waits for the terminals to die before touching the folder', async () => {
    const store = makeStore();

    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(order).toEqual(['terminals closed', 'worktree removed']);
    expect(deleteGithubPrCacheForWorktreePath).toHaveBeenCalledWith({
      db: {},
      worktreePath: '/repo/.goodboy/worktrees/gb-ghost',
    });
  });

  it('reports the paths it could not remove', async () => {
    const store = makeStore();
    removeWorktree.mockRejectedValueOnce(new Error('Directory not empty'));

    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'failed to remove 1 session paths',
      expect.stringContaining('Directory not empty'),
      expect.anything(),
    );
  });
});
