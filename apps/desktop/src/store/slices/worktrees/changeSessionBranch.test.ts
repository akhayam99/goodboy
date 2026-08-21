import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  listWorktreesForSession: vi.fn(async () => [
    {
      worktreePath: '/repos/goodboy/.goodboy/worktrees/task',
      branch: 'ak/outgoing',
      parallelIndex: 0,
    },
  ]),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  changeWorktreeBranch: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  listWorktreesForSession: h.listWorktreesForSession,
  updateSessionWorktreeBranch: h.updateSessionWorktreeBranch,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/worktree/worktree', () => ({
  changeWorktreeBranch: h.changeWorktreeBranch,
  invalidateLocalBranchesCache: vi.fn(),
}));

import { changeSessionBranch } from './changeSessionBranch';

const SESSION_ID = 'session-1' as SessionId;

type State = Record<string, unknown>;

const makeState = (): State => ({
  sessions: [{ id: SESSION_ID, workspaceId: 'workspace-1' }],
  workspaces: [{ id: 'workspace-1', kind: 'repo', rootPath: '/repos/goodboy' }],
  sessionBranches: { [SESSION_ID]: 'ak/outgoing' },
  sessionMounts: {},
  sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
  sessionGithubPrs: { [SESSION_ID]: [{ number: 42 }] },
  sessionSelectedPrNumber: { [SESSION_ID]: 40 },
  sessionExternalTasks: {
    [SESSION_ID]: [{ provider: 'linear', externalId: 'GB-1', branch: 'ak/outgoing' }],
  },
  emitNotification: h.emitNotification,
  recordSessionEvent: vi.fn(async () => undefined),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('changeSessionBranch', () => {
  it('surfaces the branch change as an event naming the work it leaves behind', async () => {
    const state = makeState();
    const set = vi.fn((updater: (current: State) => State) => {
      Object.assign(state, updater(state));
    });

    await changeSessionBranch(set as never, (() => state) as never)(SESSION_ID, {
      branch: 'ak/incoming',
      createNew: false,
    });

    expect(h.emitNotification).toHaveBeenCalledWith(
      'branch-changed',
      'info',
      'Branch is now ak/incoming',
      '1 linked issue stays on ak/outgoing and moved to the work history. Pull requests now read from ak/incoming.',
      { sessionId: SESSION_ID, workspaceId: 'workspace-1' },
    );
  });

  it('writes the switch to the session trace with both branch names', async () => {
    const state = makeState();
    const set = vi.fn((updater: (current: State) => State) => {
      Object.assign(state, updater(state));
    });

    await changeSessionBranch(set as never, (() => state) as never)(SESSION_ID, {
      branch: 'ak/incoming',
      createNew: false,
    });

    expect(state['recordSessionEvent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'branch_switched',
      payload: { from: 'ak/outgoing', to: 'ak/incoming' },
    });
  });

  it('resets the pull requests of the outgoing branch and the selected one', async () => {
    const state = makeState();
    const set = vi.fn((updater: (current: State) => State) => {
      Object.assign(state, updater(state));
    });

    await changeSessionBranch(set as never, (() => state) as never)(SESSION_ID, {
      branch: 'ak/incoming',
      createNew: false,
    });

    expect(state.sessionBranches).toEqual({ [SESSION_ID]: 'ak/incoming' });
    expect(state.sessionGithub).toEqual({});
    expect(state.sessionGithubPrs).toEqual({});
    expect(state.sessionSelectedPrNumber).toEqual({});
  });
});
