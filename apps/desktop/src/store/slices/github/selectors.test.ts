import { renderHook } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Session,
  SessionId,
  Project,
  ProjectId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

import { useSessionPrFetchState } from './selectors';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_ID = 'mount-1' as MountId;

const ACTIVITY_AT = '2026-07-27T10:00:00.000Z' as IsoDateTime;

const createSession = (id: SessionId): Session =>
  aSession({
    id,
    workspaceId: WORKSPACE_ID,
    activeProjectId: PROJECT_ID,
    goal: 'ship the fix',
    state: { kind: 'idle', lastActivityAt: ACTIVITY_AT },
    createdAt: ACTIVITY_AT,
    updatedAt: ACTIVITY_AT,
  });

const createWorkspace = (): Workspace => aWorkspace({ id: WORKSPACE_ID });

const createProject = (kind: Project['kind'] = 'repo'): Project =>
  aProject({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    rootPath: '/tmp/ws',
    name: 'project',
    kind,
  });

const setProjectScope = ({ kind = 'repo' }: { readonly kind?: Project['kind'] } = {}): void => {
  store.state.workspaces = [createWorkspace()];
  store.state.projects = [createProject(kind)];
  store.state.sessionProjectMounts = {
    [SESSION_ID]: [
      {
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        mountName: 'project',
        repoRoot: '/tmp/ws',
        worktreePath: '/tmp/ws-worktree',
        branch: kind === 'repo' ? 'ak/feat-thing' : '',
      },
    ],
  };
  store.state.sessionActiveProject = { [SESSION_ID]: PROJECT_ID };
};

beforeEach(() => {
  store.state = {
    sessionPhaseRuns: {},
    selectedAgentId: {},
    currentSessionId: null,
    agentKindOverride: {},
    terminalTabs: {},
    terminalSessions: {},
    sessionGithub: {},
    sessionGitlabMr: {},
    sessionOpenQuestions: {},
    sessionViewPrefs: {},
    getSessionViewPrefs: vi.fn(),
    selectedProjectIds: {},
    getSelectedProjectIds: vi.fn(),
    sessions: [],
    workspaces: [],
    projects: [],
    sessionBranches: {},
    sessionWorktrees: {},
    sessionWorktreeRecords: {},
    summarizerStatus: {},
    sessionProjectMounts: {},
    sessionActiveProject: {},
    githubStatus: null,
  };
});

describe('useSessionPrFetchState', () => {
  const fetchableSession = () => {
    const session = createSession(SESSION_ID);
    store.state.sessions = [session];
    setProjectScope();
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionWorktrees = { [SESSION_ID]: ['/tmp/ws-worktree'] };
    store.state.githubStatus = { available: true };
    return session;
  };

  it('reports unknown while a fetchable session is still waiting on its first fetch', () => {
    fetchableSession();

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('unknown');
  });

  it('reports known once that session fetch has landed', () => {
    fetchableSession();
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: '2026-08-04T10:00:00.000Z', failedAt: null },
    };

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('known');
  });

  it('reports unreachable once every attempt for that session failed', () => {
    fetchableSession();
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: null, failedAt: '2026-08-04T10:00:00.000Z' },
    };

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('unreachable');
  });

  it('reports known for a folder project, which never gets a pull request fetched', () => {
    const session = createSession(SESSION_ID);
    store.state.sessions = [session];
    setProjectScope({ kind: 'folder' });
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionWorktrees = { [SESSION_ID]: ['/tmp/ws-worktree'] };
    store.state.githubStatus = { available: true };

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('known');
  });

  it('reports known for a mount with no branch, which the sweep skips', () => {
    fetchableSession();
    setProjectScope({ kind: 'folder' });
    store.state.sessionBranches = {};

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('known');
  });
});
