import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  SessionId,
  StepId,
  TelemetryKind,
  TelemetryRecord,
  WorkflowRunId,
} from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('./store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

import { sumSessionCost, useLiveTerminalCount, useSessionUnreadLens } from './selectors';

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

beforeEach(() => {
  store.state = {
    sessionPhaseRuns: {},
    selectedAgentId: {},
    currentSessionId: null,
    agentKindOverride: {},
    terminalTabs: {},
    terminalSessions: {},
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
