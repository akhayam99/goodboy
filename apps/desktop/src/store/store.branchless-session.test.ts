import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  changeWorktreeBranch,
  removeWorktree,
  listWorktreesForSession,
  updateSessionWorktreeBranch,
  deleteSession,
  deleteFileVersionsForSession,
  fileVersionsPurgeSession,
  detectRepoSlug,
} = vi.hoisted(() => ({
  changeWorktreeBranch: vi.fn(async () => undefined),
  removeWorktree: vi.fn(async () => undefined),
  listWorktreesForSession: vi.fn(async () => [
    { worktreePath: '/root/sessions/study-plan', branch: '', parallelIndex: 0 },
  ]),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  deleteFileVersionsForSession: vi.fn(async () => undefined),
  fileVersionsPurgeSession: vi.fn(async () => undefined),
  detectRepoSlug: vi.fn(async () => 'acme/widgets'),
}));

vi.mock('@goodboy/db', () => ({
  listWorktreesForSession,
  updateSessionWorktreeBranch,
  deleteSession,
  deleteFileVersionsForSession,
}));

vi.mock('@goodboy/core', () => ({
  detectRepoSlug,
  fetchLinkedIssues: vi.fn(async () => []),
  getPrForBranch: vi.fn(async () => null),
}));

vi.mock('../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../features/worktree/worktree', () => ({
  changeWorktreeBranch,
  removeWorktree,
  invalidateLocalBranchesCache: vi.fn(),
}));

vi.mock('../features/file-versions/fileVersions', () => ({
  fileVersionsPurgeSession,
  fileVersionsDelete: vi.fn(async () => undefined),
}));

vi.mock('../features/chat/turn', () => ({ cancelTurn: vi.fn(async () => undefined) }));

vi.mock('../features/github/github', () => ({
  createTauriPrCacheStore: vi.fn(() => ({})),
  tauriGhRunner: {},
}));

import { changeSessionBranch } from './slices/worktrees/changeSessionBranch';
import { deleteTask } from './slices/sessions/deleteTask';
import { refreshSessionPr } from './slices/github/refreshSessionPr';

const SESSION_ID = 'sess-1' as never;

type Store = {
  sessions: ReadonlyArray<{
    id: string;
    workspaceId: string;
    goal: string;
    state: { kind: string };
  }>;
  archivedSessions: Record<string, ReadonlyArray<unknown>>;
  workspaces: ReadonlyArray<{ id: string; rootPath: string; kind: string }>;
  sessionBranches: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionGithub: Record<string, unknown>;
  sessionGithubPrs: Record<string, ReadonlyArray<unknown>>;
  sessionSelectedPrNumber: Record<string, number | null>;
  sessionExternalTasks: Record<string, ReadonlyArray<{ readonly branch?: string }>>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  closeSessionTerminals: () => Promise<void>;
  emitNotification: () => void;
};

const makeStore = (branch: string): Store => ({
  sessions: [{ id: 'sess-1', workspaceId: 'ws-1', goal: 'plan a trip', state: { kind: 'idle' } }],
  archivedSessions: {},
  workspaces: [{ id: 'ws-1', rootPath: '/root', kind: 'repo' }],
  sessionBranches: { 'sess-1': branch },
  sessionWorktrees: { 'sess-1': ['/root/sessions/study-plan'] },
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

describe('a branchless session in a workspace converted to repo', () => {
  it('never switches branch', async () => {
    const store = makeStore('');
    await changeSessionBranch(vi.fn(), (() => store) as never)(SESSION_ID, {
      branch: 'main',
      createNew: false,
    });

    expect(changeWorktreeBranch).not.toHaveBeenCalled();
    expect(updateSessionWorktreeBranch).not.toHaveBeenCalled();
  });

  it('never removes a git worktree on delete', async () => {
    const store = makeStore('');
    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(removeWorktree).not.toHaveBeenCalled();
    expect(fileVersionsPurgeSession).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it('never refreshes a pull request', async () => {
    const store = makeStore('');
    await refreshSessionPr(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(detectRepoSlug).not.toHaveBeenCalled();
  });
});

describe('a repo-backed session in the same workspace', () => {
  it('still switches branch', async () => {
    const store = makeStore('gb/plan-a-trip');
    listWorktreesForSession.mockResolvedValueOnce([
      {
        worktreePath: '/root/.goodboy/worktrees/gb-plan',
        branch: 'gb/plan-a-trip',
        parallelIndex: 0,
      },
    ]);

    await changeSessionBranch(vi.fn(), (() => store) as never)(SESSION_ID, {
      branch: 'main',
      createNew: false,
    });

    expect(changeWorktreeBranch).toHaveBeenCalledWith({
      repoPath: '/root',
      worktreePath: '/root/.goodboy/worktrees/gb-plan',
      branch: 'main',
      createNew: false,
    });
  });

  it('still removes its git worktree on delete', async () => {
    const store = makeStore('gb/plan-a-trip');
    await deleteTask(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(removeWorktree).toHaveBeenCalledWith('/root', '/root/sessions/study-plan');
    expect(fileVersionsPurgeSession).not.toHaveBeenCalled();
  });

  it('still refreshes its pull request', async () => {
    const store = makeStore('gb/plan-a-trip');
    await refreshSessionPr(vi.fn(), (() => store) as never)(SESSION_ID);

    expect(detectRepoSlug).toHaveBeenCalled();
  });
});
