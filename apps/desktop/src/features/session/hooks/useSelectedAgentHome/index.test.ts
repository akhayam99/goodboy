import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';

type StoreState = {
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  selectedAgentId: Record<string, AgentId>;
  agentKindOverride: Record<string, string>;
};

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = {
    state: {
      sessionPhaseRuns: {},
      selectedAgentId: {},
      agentKindOverride: {},
    },
  };
  return { store };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

import { useSelectedAgentHome } from './index';

const SESSION_ID = 'session-1' as SessionId;
const ROOT_ID = 'root' as AgentId;
const CHILD_ID = 'child' as AgentId;

type Params = {
  readonly id: AgentId;
  readonly kind: string;
  readonly parentAgentId?: AgentId;
  readonly workflowRunId?: WorkflowRunId;
  readonly stepId?: StepId;
};

const createAgent = ({ id, kind, parentAgentId, workflowRunId, stepId }: Params): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: kind,
  status: 'pending',
  kind,
  parentAgentId,
  workflowRunId,
  stepId,
});

beforeEach(() => {
  store.state = {
    sessionPhaseRuns: {},
    selectedAgentId: { [SESSION_ID]: CHILD_ID },
    agentKindOverride: {},
  };
});

describe('useSelectedAgentHome', () => {
  it('routes a cluster sub-agent to the workflow-step parent home', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({
          id: ROOT_ID,
          kind: 'implementer',
          workflowRunId: 'workflow-1' as WorkflowRunId,
          stepId: 'step-1' as StepId,
        }),
        createAgent({
          id: CHILD_ID,
          kind: 'scout',
          parentAgentId: ROOT_ID,
          workflowRunId: 'workflow-1' as WorkflowRunId,
        }),
      ],
    };

    const { result } = renderHook(() => useSelectedAgentHome(SESSION_ID));

    expect(result.current).toBe('workflows');
  });

  it('keeps an ad-hoc scout child in the agents home', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({ id: ROOT_ID, kind: 'scout' }),
        createAgent({ id: CHILD_ID, kind: 'scout', parentAgentId: ROOT_ID }),
      ],
    };

    const { result } = renderHook(() => useSelectedAgentHome(SESSION_ID));

    expect(result.current).toBe('agents');
  });

  it('uses the resolver root override instead of the child override', () => {
    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        createAgent({ id: ROOT_ID, kind: 'generic' }),
        createAgent({ id: CHILD_ID, kind: 'scout', parentAgentId: ROOT_ID }),
      ],
    };
    store.state.agentKindOverride = {
      [ROOT_ID]: 'resolver',
      [CHILD_ID]: 'implementer',
    };

    const { result } = renderHook(() => useSelectedAgentHome(SESSION_ID));

    expect(result.current).toBe('review');
  });
});
