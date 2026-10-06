import { act, renderHook } from '@testing-library/react';
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
  const listeners = new Set<() => void>();
  const store = {
    state: {} as StoreState,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
  return { store };
});

vi.mock('../../store', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAppStore: (selector: (state: StoreState) => unknown) =>
      useSyncExternalStore(store.subscribe, () => selector(store.state)),
  };
});

import {
  useSessionStageInfo,
  useSortedGroupedSessions,
  useStageGroupedSessions,
} from './selectors';

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

describe('useSessionStageInfo pull request freshness', () => {
  const repoSession = () => {
    const session = createSession(SESSION_ID);
    store.state.sessions = [session];
    setProjectScope();
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionWorktrees = { [SESSION_ID]: ['/tmp/ws-worktree'] };
    return session;
  };

  it('does not claim a session has no PR before the first fetch lands', () => {
    const session = repoSession();
    store.state.githubStatus = { available: true };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.stage).toBe('building');
    expect(result.current.reason).toBe('checking GitHub');
  });

  it('claims no PR once that session fetch has landed with none', () => {
    const session = repoSession();
    store.state.githubStatus = { available: true };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: '2026-08-04T10:00:00.000Z', failedAt: null },
    };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.reason).toBe('no PR yet');
  });

  it('claims no PR right away when gh is absent, leaving nothing to wait for', () => {
    const session = repoSession();
    store.state.githubStatus = { available: false };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.reason).toBe('no PR yet');
  });

  it('says GitHub is unreachable when every attempt for that session failed', () => {
    const session = repoSession();
    store.state.githubStatus = { available: true };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: null, failedAt: '2026-08-04T10:00:00.000Z' },
    };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.reason).toBe('GitHub unreachable');
  });

  it('claims no PR for a mount with no branch, which no fetch will ever cover', () => {
    const session = repoSession();
    setProjectScope({ kind: 'folder' });
    store.state.sessionBranches = {};
    store.state.githubStatus = { available: true };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.reason).toBe('no PR yet');
  });

  it('claims no PR for a session whose worktree never landed', () => {
    const session = repoSession();
    store.state.sessionWorktrees = {};
    store.state.sessionProjectMounts = {};
    store.state.githubStatus = { available: true };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.reason).toBe('no PR yet');
  });
});

describe('useSessionStageInfo settled request state', () => {
  const repoSession = () => {
    const session = createSession(SESSION_ID);
    store.state.sessions = [session];
    setProjectScope();
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionWorktrees = { [SESSION_ID]: ['/tmp/ws-worktree'] };
    store.state.githubStatus = { available: true };
    return session;
  };

  const githubPr = (state: string) => ({
    number: 12,
    title: 'a change',
    url: 'https://github.test/pr/12',
    state,
    mergeable: null,
    checks: null,
    baseBranch: 'main',
    headBranch: 'ak/feat-thing',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-08-04T10:00:00.000Z',
  });

  const gitlabMr = (state: string) => ({
    id: 91,
    iid: 7,
    title: 'a change',
    webUrl: 'https://gitlab.test/mr/7',
    state,
    draft: false,
    sourceBranch: 'ak/feat-thing',
    targetBranch: 'main',
    description: '',
    updatedAt: '2026-08-04T10:00:00.000Z',
  });

  it('carries a closed github pull request onto the stage, apart from a merged one', () => {
    const session = repoSession();
    store.state.sessionGithub = {
      [SESSION_ID]: {
        pr: githubPr('closed'),
        fetchedAt: '2026-08-04T10:00:00.000Z',
        failedAt: null,
      },
    };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.stage).toBe('done');
    expect(result.current.prState).toBe('closed');
  });

  it('carries a closed gitlab merge request onto the stage too', () => {
    const session = repoSession();
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: '2026-08-04T10:00:00.000Z', failedAt: null },
    };
    store.state.sessionGitlabMr = { [SESSION_ID]: { mr: gitlabMr('closed') } };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.stage).toBe('done');
    expect(result.current.prState).toBe('closed');
  });

  it('carries a merged gitlab merge request as merged, never as closed', () => {
    const session = repoSession();
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: '2026-08-04T10:00:00.000Z', failedAt: null },
    };
    store.state.sessionGitlabMr = { [SESSION_ID]: { mr: gitlabMr('merged') } };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.stage).toBe('done');
    expect(result.current.prState).toBe('merged');
  });

  it('leaves the request state null when there is no request at all', () => {
    const session = repoSession();
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: null, fetchedAt: '2026-08-04T10:00:00.000Z', failedAt: null },
    };

    const { result } = renderHook(() => useSessionStageInfo(session));

    expect(result.current.prState).toBeNull();
  });
});

describe('useSortedGroupedSessions', () => {
  it('derives stages with the default stage grouping', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useSortedGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'building', sessions }]);
  });

  it.each(['pr', 'none'] as const)(
    'keeps the same array reference across store updates while grouping by %s',
    (group) => {
      store.state.workspaces = [createWorkspace()];
      store.state.projects = [createProject()];
      store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
      store.state.sessionViewPrefs = { [WORKSPACE_ID]: { sort: 'updatedAt', group } };
      const sessions = [createSession(SESSION_ID)];

      const { result, rerender } = renderHook(() =>
        useSortedGroupedSessions(WORKSPACE_ID, sessions),
      );
      const first = result.current;

      store.state.currentSessionId = 'unrelated-session' as SessionId;
      rerender();

      expect(result.current).toBe(first);
    },
  );
});

describe('useStageGroupedSessions', () => {
  it('groups a repo session by its pull request stage', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: { number: 12, state: 'merged', isDraft: false } },
    };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'done', sessions }]);
  });

  it('groups a GitLab-only session by its merge request stage', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionGitlabMr = {
      [SESSION_ID]: {
        mr: { iid: 7, state: 'merged', draft: false, sourceBranch: 'ak/feat-thing' },
      },
    };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'done', sessions }]);
  });

  it('keeps a branchless simple-workspace session out of the pull request stages', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: '' };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: { number: 12, state: 'merged', isDraft: false } },
    };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'building', sessions }]);
  });

  it('keeps the same array reference when an unrelated store field changes', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    const sessions = [createSession(SESSION_ID)];

    const { result, rerender } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));
    const first = result.current;

    store.state.currentSessionId = 'unrelated-session' as SessionId;
    rerender();

    expect(result.current).toBe(first);
  });

  it('returns a new reference when a session object is replaced under the same id', () => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    let sessions = [createSession(SESSION_ID)];

    const { result, rerender } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));
    const first = result.current;

    sessions = [{ ...createSession(SESSION_ID), goal: 'renamed goal' }];
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current[0]?.sessions[0]?.goal).toBe('renamed goal');
  });

  it('returns a new reference when a session is added', () => {
    const otherId = 'session-2' as SessionId;
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing', [otherId]: 'ak/feat-two' };
    let sessions = [createSession(SESSION_ID)];

    const { result, rerender } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));
    const first = result.current;

    sessions = [...sessions, createSession(otherId)];
    rerender();

    expect(result.current).not.toBe(first);
  });
});

describe('fix runs and the grouped sessions', () => {
  const OTHER_ID = 'session-other' as SessionId;

  const fixThread = (threadId: string, state: 'working' | 'needs_answer') => ({
    id: `row-${threadId}`,
    sessionId: SESSION_ID,
    threadId,
    state,
    stateReason: null,
    activeAttemptId: 'attempt-1',
  });

  const withFixRunOf = ({
    sessionId,
    state,
  }: {
    readonly sessionId: SessionId;
    readonly state: 'working' | 'needs_answer';
  }): void => {
    store.state.sessionResolveThreads = {
      ...(store.state.sessionResolveThreads as Record<string, unknown>),
      [sessionId]: [fixThread(`PRRT_${sessionId}`, state)],
    };
    store.state.sessionResolveAttempts = {
      ...(store.state.sessionResolveAttempts as Record<string, unknown>),
      [sessionId]: [],
    };
  };

  beforeEach(() => {
    store.state.workspaces = [createWorkspace()];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing', [OTHER_ID]: 'ak/feat-two' };
    store.state.sessionResolveThreads = {};
    store.state.sessionResolveAttempts = {};
  });

  it.each([
    ['useStageGroupedSessions', useStageGroupedSessions],
    ['useSortedGroupedSessions', useSortedGroupedSessions],
  ])(
    '%s renders nothing again when a fix run changes in a session it does not show',
    (_name, useGrouped) => {
      const sessions = [createSession(SESSION_ID)];
      withFixRunOf({ sessionId: SESSION_ID, state: 'working' });
      let renders = 0;
      const { result } = renderHook(() => {
        renders += 1;
        return useGrouped(WORKSPACE_ID, sessions);
      });
      const first = result.current;
      const rendersBefore = renders;

      act(() => {
        withFixRunOf({ sessionId: OTHER_ID, state: 'needs_answer' });
        store.notify();
      });

      expect(renders).toBe(rendersBefore);
      expect(result.current).toBe(first);
    },
  );

  it.each([
    ['useStageGroupedSessions', useStageGroupedSessions],
    ['useSortedGroupedSessions', useSortedGroupedSessions],
  ])(
    '%s groups the session again when a fix run changes in a session it shows',
    (_name, useGrouped) => {
      const sessions = [createSession(SESSION_ID)];
      withFixRunOf({ sessionId: SESSION_ID, state: 'working' });
      const { result } = renderHook(() => useGrouped(WORKSPACE_ID, sessions));
      expect(result.current.map((group) => group.key)).not.toContain('attention');

      act(() => {
        withFixRunOf({ sessionId: SESSION_ID, state: 'needs_answer' });
        store.notify();
      });

      expect(result.current.map((group) => group.key)).toContain('attention');
    },
  );
});

describe('shared project filtering', () => {
  it('feeds the same project selection into sidebar and board grouping', () => {
    const mounted = createSession(SESSION_ID);
    const unmounted = createSession('session-2' as SessionId);
    setProjectScope();
    store.state.selectedProjectIds = { [WORKSPACE_ID]: [PROJECT_ID] };
    store.state.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: PROJECT_ID,
          mountName: 'project',
          repoRoot: '/tmp/ws',
          worktreePath: '/tmp/ws-worktree',
          branch: 'ak/feat-thing',
        },
      ],
      [unmounted.id]: [],
    };
    const { result } = renderHook(() => ({
      sidebar: useSortedGroupedSessions(WORKSPACE_ID, [mounted, unmounted]),
      board: useStageGroupedSessions(WORKSPACE_ID, [mounted, unmounted]),
    }));
    const sidebarIds = result.current.sidebar.flatMap((group) =>
      group.sessions.map((session) => session.id),
    );
    const boardIds = result.current.board.flatMap((group) =>
      group.sessions.map((session) => session.id),
    );
    expect(sidebarIds).toEqual([SESSION_ID]);
    expect(boardIds).toEqual([SESSION_ID]);
  });
});
