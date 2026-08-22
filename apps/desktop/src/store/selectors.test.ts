import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  Session,
  SessionId,
  StepId,
  Project,
  ProjectId,
  TelemetryKind,
  TelemetryRecord,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('./store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

import {
  sumSessionCost,
  useIsSessionCollectionLoaded,
  useSessionPrFetchState,
  useSessionStageInfo,
  useSortedGroupedSessions,
  useStageGroupedSessions,
} from './selectors';

type Params = {
  readonly kind: TelemetryKind;
  readonly estimatedCostUsd: number;
};

const createRecord = ({ kind, estimatedCostUsd }: Params): TelemetryRecord =>
  ({ kind, estimatedCostUsd }) as TelemetryRecord;

type AgentParams = {
  readonly id: AgentId;
  readonly kind?: string;
  readonly parentAgentId?: AgentId;
  readonly workflowRunId?: WorkflowRunId;
  readonly stepId?: StepId;
  readonly lastFinishedAt?: string;
};

const createAgent = ({
  id,
  kind,
  parentAgentId,
  workflowRunId,
  stepId,
  lastFinishedAt = '2026-07-21T10:00:00.000Z',
}: AgentParams): Agent =>
  ({
    id,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent',
    status: 'completed',
    kind,
    parentAgentId,
    workflowRunId,
    stepId,
    lastFinishedAt,
    lastViewedAt: null,
  }) as unknown as Agent;

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;

const createSession = (id: SessionId): Session =>
  ({
    id,
    workspaceId: WORKSPACE_ID,
    activeProjectId: PROJECT_ID,
    goal: 'ship the fix',
    state: { kind: 'idle', lastActivityAt: '2026-07-27T10:00:00.000Z' },
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    workflowRuns: [],
  }) as unknown as Session;

const createWorkspace = (): Workspace => ({ id: WORKSPACE_ID }) as unknown as Workspace;

const createProject = (kind: Project['kind'] = 'repo'): Project =>
  ({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    rootPath: '/tmp/ws',
    name: 'project',
    kind,
  }) as unknown as Project;

const setProjectScope = ({ kind = 'repo' }: { readonly kind?: Project['kind'] } = {}): void => {
  store.state.workspaces = [createWorkspace()];
  store.state.projects = [createProject(kind)];
  store.state.sessionProjectMounts = {
    [SESSION_ID]: [
      {
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
    sessions: [],
    workspaces: [],
    projects: [],
    sessionBranches: {},
    sessionWorktrees: {},
    sessionProjectMounts: {},
    sessionActiveProject: {},
    githubStatus: null,
  };
});

describe('useIsSessionCollectionLoaded', () => {
  const COLLECTIONS = [
    ['agents', 'sessionPhaseRuns'],
    ['plans', 'sessionPlans'],
    ['workflows', 'sessionWorkflows'],
    ['reviewDrafts', 'reviewDrafts'],
    ['externalTasks', 'sessionExternalTasks'],
    ['openQuestions', 'sessionOpenQuestions'],
    ['fileVersions', 'sessionFileVersions'],
  ] as const;

  it.each(COLLECTIONS)(
    'reads %s as never loaded while its record has no key',
    (collection, key) => {
      store.state[key] = {};

      const { result } = renderHook(() =>
        useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection }),
      );

      expect(result.current).toBe(false);
    },
  );

  it.each(COLLECTIONS)('reads %s as loaded once its key holds an empty list', (collection, key) => {
    store.state[key] = { [SESSION_ID]: [] };

    const { result } = renderHook(() =>
      useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection }),
    );

    expect(result.current).toBe(true);
  });

  it('never reads one session as loaded because a sibling loaded', () => {
    store.state.sessionWorkflows = { 'session-2': [] };

    const { result } = renderHook(() =>
      useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection: 'workflows' }),
    );

    expect(result.current).toBe(false);
  });
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

  it('claims no PR for a session with no branch, which no fetch will ever cover', () => {
    const session = repoSession();
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

  it('reports known for a session with no branch, which the sweep skips', () => {
    fetchableSession();
    store.state.sessionBranches = {};

    const { result } = renderHook(() => useSessionPrFetchState(SESSION_ID));

    expect(result.current).toBe('known');
  });
});

describe('sumSessionCost', () => {
  it('sums turn costs and skips summarizer costs', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 1.25 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 8 }),
      createRecord({ kind: 'turn', estimatedCostUsd: 0.5 }),
    ];

    expect(sumSessionCost(records)).toBe(1.75);
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
