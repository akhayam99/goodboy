import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  Session,
  SessionId,
  StepId,
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
  useLiveTerminalCount,
  useSessionUnreadLens,
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

const createSession = (id: SessionId): Session =>
  ({
    id,
    workspaceId: WORKSPACE_ID,
    goal: 'ship the fix',
    state: { kind: 'idle', lastActivityAt: '2026-07-27T10:00:00.000Z' },
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    workflowRuns: [],
  }) as unknown as Session;

const createWorkspace = (kind: string): Workspace =>
  ({ id: WORKSPACE_ID, kind, rootPath: '/tmp/ws' }) as unknown as Workspace;

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
    workspaces: [],
    sessionBranches: {},
  };
});

describe('useLiveTerminalCount', () => {
  it('counts dock tabs that have not exited', () => {
    store.state.terminalTabs = {
      [SESSION_ID]: [{ status: 'running' }, { status: 'attention' }, { status: 'exited' }],
    };

    const { result } = renderHook(() => useLiveTerminalCount(SESSION_ID));

    expect(result.current).toBe(2);
  });

  it('counts the scripts-panel terminal as a live terminal too', () => {
    store.state.terminalSessions = { [SESSION_ID]: 'open' };

    const { result } = renderHook(() => useLiveTerminalCount(SESSION_ID));

    expect(result.current).toBe(1);
  });

  it('returns zero once every terminal is gone', () => {
    store.state.terminalTabs = { [SESSION_ID]: [{ status: 'exited' }] };
    store.state.terminalSessions = { [SESSION_ID]: 'closed' };

    const { result } = renderHook(() => useLiveTerminalCount(SESSION_ID));

    expect(result.current).toBe(0);
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

describe('useSessionUnreadLens', () => {
  it('routes a workflow-step agent reply to workflows', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({
          id: AGENT_ID,
          kind: 'resolver',
          workflowRunId: 'workflow-1' as WorkflowRunId,
          stepId: 'step-1' as StepId,
        }),
      ],
    };

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBe('workflows');
  });

  it('routes a cluster child reply through its workflow-step parent', () => {
    const parentId = 'parent' as AgentId;
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({
          id: parentId,
          kind: 'implementer',
          workflowRunId: 'workflow-1' as WorkflowRunId,
          stepId: 'step-1' as StepId,
          lastFinishedAt: '2026-07-21T09:00:00.000Z',
        }),
        createAgent({
          id: AGENT_ID,
          kind: 'scout',
          parentAgentId: parentId,
          workflowRunId: 'workflow-1' as WorkflowRunId,
        }),
      ],
    };

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBe('workflows');
  });

  it('routes a resolver reply to resolve', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [createAgent({ id: AGENT_ID, kind: 'resolver' })],
    };

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBe('resolve');
  });

  it('routes a standalone agent reply to agents', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [createAgent({ id: AGENT_ID, kind: 'implementer' })],
    };

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBe('agents');
  });

  it('returns null when the unread agent is selected in the current session', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [createAgent({ id: AGENT_ID, kind: 'implementer' })],
    };
    store.state.selectedAgentId = { [SESSION_ID]: AGENT_ID };
    store.state.currentSessionId = SESSION_ID;

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBeNull();
  });

  it('routes to the most recently finished unread agent lens', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({
          id: 'older-resolver' as AgentId,
          kind: 'resolver',
          lastFinishedAt: '2026-07-21T10:00:00.000Z',
        }),
        createAgent({
          id: 'newer-workflow' as AgentId,
          kind: 'implementer',
          workflowRunId: 'workflow-1' as WorkflowRunId,
          stepId: 'step-1' as StepId,
          lastFinishedAt: '2026-07-21T11:00:00.000Z',
        }),
      ],
    };

    const { result } = renderHook(() => useSessionUnreadLens(SESSION_ID));

    expect(result.current).toBe('workflows');
  });
});

describe('useSortedGroupedSessions', () => {
  it('derives stages with the default stage grouping', () => {
    store.state.workspaces = [createWorkspace('repo')];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useSortedGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'building', sessions }]);
  });
});

describe('useStageGroupedSessions', () => {
  it('groups a repo session by its pull request stage', () => {
    store.state.workspaces = [createWorkspace('repo')];
    store.state.sessionBranches = { [SESSION_ID]: 'ak/feat-thing' };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: { number: 12, state: 'merged', isDraft: false } },
    };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'done', sessions }]);
  });

  it('groups a GitLab-only session by its merge request stage', () => {
    store.state.workspaces = [createWorkspace('repo')];
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
    store.state.workspaces = [createWorkspace('simple')];
    store.state.sessionBranches = { [SESSION_ID]: '' };
    store.state.sessionGithub = {
      [SESSION_ID]: { pr: { number: 12, state: 'merged', isDraft: false } },
    };
    const sessions = [createSession(SESSION_ID)];

    const { result } = renderHook(() => useStageGroupedSessions(WORKSPACE_ID, sessions));

    expect(result.current).toEqual([{ key: 'building', sessions }]);
  });
});
