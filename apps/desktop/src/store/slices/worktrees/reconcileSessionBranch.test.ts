import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';

const WORKTREE_PATH = '/repos/goodboy/.goodboy/worktrees/task';

const h = vi.hoisted(() => ({
  listWorktreesForSession: vi.fn(async () => [
    {
      worktreePath: '/repos/goodboy/.goodboy/worktrees/task',
      branch: 'ak/outgoing',
      parallelIndex: 0,
    },
  ]),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  listWorktreesForSession: h.listWorktreesForSession,
  updateSessionWorktreeBranch: h.updateSessionWorktreeBranch,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { reconcileSessionBranch } from './reconcileSessionBranch';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;

type State = Record<string, unknown>;

const makeState = (): State => ({
  sessions: [{ id: SESSION_ID, workspaceId: 'workspace-1' }],
  projects: [
    { id: PROJECT_ID, workspaceId: 'workspace-1', kind: 'repo', rootPath: '/repos/goodboy' },
  ],
  sessionBranches: { [SESSION_ID]: 'ak/outgoing' },
  sessionProjectMounts: {
    [SESSION_ID]: [
      {
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: WORKTREE_PATH,
        repoRoot: '/repos/goodboy',
        branch: 'ak/outgoing',
      },
    ],
  },
  sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
  sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: [{ number: 42 }] } },
  sessionSelectedPrNumber: { [SESSION_ID]: 40 },
  sessionExternalTasks: { [SESSION_ID]: [] },
  emitNotification: h.emitNotification,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcileSessionBranch', () => {
  it('announces a branch observed outside the app and resets the branch pull requests', async () => {
    const state = makeState();
    const set = vi.fn((updater: (current: State) => State) => {
      Object.assign(state, updater(state));
    });

    await reconcileSessionBranch(set as never, (() => state) as never)(SESSION_ID, 'ak/incoming');

    expect(h.emitNotification).toHaveBeenCalledWith(
      'branch-changed',
      'info',
      'Branch is now ak/incoming',
      'Pull requests now read from ak/incoming.',
      { sessionId: SESSION_ID, workspaceId: 'workspace-1' },
    );
    expect(state.sessionBranches).toEqual({ [SESSION_ID]: 'ak/incoming' });
    expect(state.sessionProjectPrs).toEqual({ [SESSION_ID]: {} });
    expect(state.sessionSelectedPrNumber).toEqual({});
  });

  it('stays silent when the observed branch is the one already recorded', async () => {
    const state = makeState();
    const set = vi.fn();

    await reconcileSessionBranch(set as never, (() => state) as never)(SESSION_ID, 'ak/outgoing');

    expect(set).not.toHaveBeenCalled();
    expect(h.emitNotification).not.toHaveBeenCalled();
  });
});
