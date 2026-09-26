import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
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
import { LENS_ICON } from '../../lens-labels';

type StoreState = Record<string, unknown>;

const { store, actions } = vi.hoisted(() => {
  const store: {
    state: StoreState;
    openQuestions: ReadonlyArray<Record<string, unknown>>;
    answeredQuestions: ReadonlyArray<Record<string, unknown>>;
  } = { state: {}, openQuestions: [], answeredQuestions: [] };
  const actions = {
    navigate: vi.fn(),
    setScriptsLensScope: vi.fn(),
    setFocusedWorkflowRun: vi.fn(),
    setFocusedArtifactId: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    setReviewMode: vi.fn(),
  };
  return { store, actions };
});

vi.mock('../../../resolve/hooks/useResolveQueueRows', () => ({
  useResolveQueueRows: () => [],
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: Object.assign((selector: (state: StoreState) => unknown) => selector(store.state), {
    getState: () => store.state,
  }),
  useSessionPlans: () => [],
  useSessionOpenQuestions: () => store.openQuestions,
  useSessionAnsweredQuestions: () => store.answeredQuestions,
}));

import { useSessionCrumbs } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_AGENT_ID = 'agent-step' as AgentId;
const ADHOC_AGENT_ID = 'agent-scout' as AgentId;
const RESOLVER_AGENT_ID = 'agent-resolver' as AgentId;

const workflow = { id: 'workflow-1', name: 'Refactor', steps: [] } as unknown as Workflow;

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

const CLUSTER_CHILD_ID = 'agent-cluster-child' as AgentId;
const clusterChild = agentOf({
  id: CLUSTER_CHILD_ID,
  name: 'area alpha',
  kind: 'implementer',
  parentAgentId: STEP_AGENT_ID,
  workflowRunId: RUN_ID,
});

const resolverAgent = agentOf({
  id: RESOLVER_AGENT_ID,
  name: 'resolve one',
  kind: 'resolver',
});

const DELEGATE_ID = 'agent-delegate' as AgentId;
const delegateAgent = agentOf({
  id: DELEGATE_ID,
  name: 'answer: pick a database',
  kind: 'scout',
  parentAgentId: STEP_AGENT_ID,
  workflowRunId: RUN_ID,
  sourceKind: 'open_question',
  sourceThreadId: 'oq-1',
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
    focusedArtifactId: {},
    sessionArtifacts: {},
    artifactCreation: {},
    selectedAgentId: {},
    sessionPhaseRuns: {
      [SESSION_ID]: [stepAgent, adHocAgent, resolverAgent, clusterChild, delegateAgent],
    },
    agentKindOverride: {},
    phaseTemplates: { 'workspace-1': [workflow] },
    sessionWorkflows: {},
    sessionBranches: { [SESSION_ID]: 'feature/one' },
    workspaces: [{ id: 'workspace-1', kind: 'repo' }],
    reviewModes: {},
    ...actions,
  };
  store.openQuestions = [];
  store.answeredQuestions = [];
});

describe('useSessionCrumbs', () => {
  it('attaches the shared concept icon to a lens crumb', () => {
    openOn({ lens: 'agents', selectedAgentId: ADHOC_AGENT_ID });
    const { result } = renderHook(() => useSessionCrumbs({ session }));

    expect(result.current[1]?.icon).toBe(LENS_ICON.agents);
  });

  it('parents a step opened from the activity feed on its run, not on overview', () => {
    expect(labelsOf(null, STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
    ]);
  });

  it('reads the same trail when the step is opened from the workflows lens', () => {
    expect(labelsOf('workflows', STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
    ]);
  });

  it('keeps a step parented on its run while the app sits in another lens', () => {
    expect(labelsOf('agents', STEP_AGENT_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
    ]);
  });

  it('gives an ad-hoc agent opened from the feed the agents home as parent', () => {
    expect(labelsOf(null, ADHOC_AGENT_ID)).toEqual(['Overview', 'Agents', 'scout one']);
  });

  it('gives a resolver opened from the feed the review home as parent, named Agent', () => {
    expect(labelsOf(null, RESOLVER_AGENT_ID)).toEqual(['Overview', 'Review', 'Agent']);
  });

  it('parents a cluster child on its father, under the run', () => {
    expect(labelsOf(null, CLUSTER_CHILD_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
      'area alpha',
    ]);
  });

  it('navigates to the father from the father crumb of a cluster child', () => {
    openOn({ lens: null, selectedAgentId: CLUSTER_CHILD_ID });
    const { result } = renderHook(() => useSessionCrumbs({ session }));

    expect(result.current[3]?.id).toBe('selected-parent');
    result.current[3]?.onClick?.();
    expect(actions.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: STEP_AGENT_ID },
    });
  });

  it('keeps a top-level step free of any father crumb', () => {
    openOn({ lens: null, selectedAgentId: STEP_AGENT_ID });
    const { result } = renderHook(() => useSessionCrumbs({ session }));

    expect(result.current.map((crumb) => crumb.id)).not.toContain('selected-parent');
    expect(result.current.map((crumb) => crumb.id)).not.toContain('selected-root');
  });

  it('ends a delegate trail on the question it answers', () => {
    store.openQuestions = [{ id: 'oq-1', text: 'pick a database' }];

    expect(labelsOf(null, DELEGATE_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
      'Answers',
      'pick a database',
    ]);
  });

  it('reads the question off the answered list once the delegate has settled it', () => {
    store.answeredQuestions = [{ id: 'oq-1', text: 'pick a database' }];

    expect(labelsOf(null, DELEGATE_ID).at(-1)).toBe('pick a database');
  });

  it('leaves the delegate trail short when the question is gone', () => {
    expect(labelsOf(null, DELEGATE_ID)).toEqual([
      'Overview',
      'Workflows',
      'Refactor',
      'Implement',
      'answer: pick a database',
    ]);
  });

  it('adds no question crumb to an agent that is not a delegate', () => {
    store.openQuestions = [{ id: 'oq-1', text: 'pick a database' }];

    expect(labelsOf(null, CLUSTER_CHILD_ID).at(-1)).toBe('area alpha');
  });

  it('navigates from the run crumb to that run, and from Workflows to the list', () => {
    openOn({ lens: null, selectedAgentId: STEP_AGENT_ID });
    const { result } = renderHook(() => useSessionCrumbs({ session }));

    result.current[2]?.onClick?.();
    expect(actions.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID);

    result.current[1]?.onClick?.();
    expect(actions.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, null);
    expect(actions.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens: 'workflows' }),
    });
  });
});
