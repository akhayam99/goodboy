import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import type { LensKind } from '../../../../store';

type StoreState = Record<string, unknown>;

const { store, actions } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  const actions = {
    setActiveLens: vi.fn(),
    setFocusedWorkflowRun: vi.fn(),
    setFocusedPlanId: vi.fn(),
  };
  return { store, actions };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
  useSessionPlans: () => [],
}));

import { useSessionCrumbs } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_AGENT_ID = 'agent-step' as AgentId;
const ADHOC_AGENT_ID = 'agent-scout' as AgentId;
const RESOLVER_AGENT_ID = 'agent-resolver' as AgentId;

const workflow = { id: 'workflow-1', name: 'refactor', steps: [] } as unknown as Workflow;

const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  workflowRuns: [{ id: RUN_ID, workflowId: 'workflow-1', ordinal: 0 }],
} as unknown as Session;

const agentOf = (overrides: Partial<Agent> & Pick<Agent, 'id' | 'name'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    status: 'running',
    ...overrides,
  }) as Agent;

const stepAgent = agentOf({
  id: STEP_AGENT_ID,
  name: 'Implement',
  kind: 'implementer',
  stepId: 'step-1' as StepId,
  workflowRunId: RUN_ID,
});

const adHocAgent = agentOf({ id: ADHOC_AGENT_ID, name: 'scout one', kind: 'scout' });

const resolverAgent = agentOf({
  id: RESOLVER_AGENT_ID,
  name: 'resolve one',
  kind: 'resolver',
});

type SurfaceParams = {
  readonly lens: LensKind | null;
  readonly selectedAgentId: AgentId;
};

const openOn = ({ lens, selectedAgentId }: SurfaceParams) => {
  store.state = {
    ...store.state,
    activeLens: { [SESSION_ID]: lens },
    selectedAgentId: { [SESSION_ID]: selectedAgentId },
  };
};

const labelsOf = (lens: LensKind | null, selectedAgentId: AgentId): ReadonlyArray<string> => {
  openOn({ lens, selectedAgentId });
  const { result } = renderHook(() => useSessionCrumbs({ session }));
  return result.current.map((crumb) => crumb.label);
};

beforeEach(() => {
  vi.clearAllMocks();
  store.state = {
    activeLens: {},
    sessionStudio: {},
    focusedWorkflowRunId: {},
    focusedPlanId: {},
    selectedAgentId: {},
    sessionPhaseRuns: { [SESSION_ID]: [stepAgent, adHocAgent, resolverAgent] },
    agentKindOverride: {},
    phaseTemplates: { 'workspace-1': [workflow] },
    sessionWorkflows: {},
    sessionBranches: { [SESSION_ID]: 'feature/one' },
    workspaces: [{ id: 'workspace-1', kind: 'repo' }],
    ...actions,
  };
});

describe('useSessionCrumbs', () => {
  it('parents a step opened from the activity feed on its run, not on overview', () => {
    expect(labelsOf(null, STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
      'Implement',
    ]);
  });

  it('reads the same trail when the step is opened from the workflows lens', () => {
    expect(labelsOf('workflows', STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
      'Implement',
    ]);
  });

  it('keeps a step parented on its run while the app sits in another lens', () => {
    expect(labelsOf('agents', STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
      'Implement',
    ]);
  });

  it('gives an ad-hoc agent opened from the feed the agents home as parent', () => {
    expect(labelsOf(null, ADHOC_AGENT_ID)).toEqual(['Overview', 'Agents', 'scout one']);
  });

  it('gives a resolver opened from the feed the resolve home as parent', () => {
    expect(labelsOf(null, RESOLVER_AGENT_ID)).toEqual(['Overview', 'Resolve', 'resolve one']);
  });

  it('navigates from the run crumb to that run, and from Workflows to the list', () => {
    openOn({ lens: null, selectedAgentId: STEP_AGENT_ID });
    const { result } = renderHook(() => useSessionCrumbs({ session }));

    result.current[2]?.onClick?.();
    expect(actions.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID);

    result.current[1]?.onClick?.();
    expect(actions.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, null);
    expect(actions.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'workflows');
  });
});
