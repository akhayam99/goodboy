// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type Store = {
  selectedAgentId: Record<string, string>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  phaseTemplates: Record<string, ReadonlyArray<Workflow>>;
  sessionWorkflows: Record<string, ReadonlyArray<Workflow>>;
};

const { store } = vi.hoisted(() => ({
  store: {
    selectedAgentId: {},
    sessionPhaseRuns: {},
    phaseTemplates: {},
    sessionWorkflows: {},
  } as Store,
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

vi.mock('../../../../workflows/components/WorkflowAdvance', () => ({
  WorkflowAdvance: () => <div data-testid="workflow-advance-mounted" />,
}));

import { WorkflowAdvanceRow } from './WorkflowAdvanceRow';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Refactor',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
    },
    { id: 'step-2' as StepId, workflowId: WORKFLOW_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'immediate',
      executionMode: 'static',
    },
  ],
} as unknown as Session;

const agent = (overrides: Partial<Agent> & Pick<Agent, 'id' | 'stepId' | 'status'>): Agent => ({
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'agent',
  ...overrides,
});

beforeEach(() => {
  store.selectedAgentId = {};
  store.sessionPhaseRuns = {};
  store.phaseTemplates = { [WORKSPACE_ID]: [workflow] };
  store.sessionWorkflows = { [SESSION_ID]: [] };
});

afterEach(cleanup);

describe('WorkflowAdvanceRow', () => {
  it('shows the advance action when the open chat is the agent of the current step', () => {
    const pending = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'pending',
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [pending] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-1' };

    render(<WorkflowAdvanceRow session={session} />);

    expect(screen.getByTestId('workflow-advance-mounted')).toBeDefined();
  });

  it('renders nothing when the open chat belongs to a different agent than the current step', () => {
    const pending = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'pending',
    });
    const unrelated = agent({
      id: 'agent-2' as AgentId,
      stepId: 'step-2' as StepId,
      status: 'pending',
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [pending, unrelated] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-2' };

    const { container } = render(<WorkflowAdvanceRow session={session} />);

    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('workflow-advance-mounted')).toBeNull();
  });

  it('shows the advance action on the failed agent chat when the run is blocked', () => {
    const failed = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'failed',
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [failed] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-1' };

    render(<WorkflowAdvanceRow session={session} />);

    expect(screen.getByTestId('workflow-advance-mounted')).toBeDefined();
  });

  it('renders nothing on a sibling chat while a different step is blocked', () => {
    const failed = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'failed',
    });
    const sibling = agent({
      id: 'agent-2' as AgentId,
      stepId: 'step-2' as StepId,
      status: 'pending',
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [failed, sibling] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-2' };

    const { container } = render(<WorkflowAdvanceRow session={session} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no run is selected for the open chat', () => {
    store.sessionPhaseRuns = {};
    store.selectedAgentId = { [SESSION_ID]: 'agent-unaffiliated' };

    const { container } = render(<WorkflowAdvanceRow session={session} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for a discarded run even when the open chat matches the current step agent', () => {
    const pending = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'pending',
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [pending] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-1' };
    const discardedSession = {
      ...session,
      workflowRuns: [
        {
          id: RUN_ID,
          workflowId: WORKFLOW_ID,
          ordinal: 0,
          currentStep: 0,
          autoRun: false,
          triggerMode: 'immediate',
          executionMode: 'static',
          discardedAt: '2026-08-18T00:00:00.000Z' as IsoDateTime,
        },
      ],
    } as unknown as Session;

    const { container } = render(<WorkflowAdvanceRow session={discardedSession} />);

    expect(container.innerHTML).toBe('');
  });

  it('shows the advance action for a cluster child agent working under the current step', () => {
    const pending = agent({
      id: 'agent-1' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'pending',
    });
    const clusterChild = agent({
      id: 'agent-1-child' as AgentId,
      stepId: 'step-1' as StepId,
      status: 'running',
      parentAgentId: 'agent-1' as AgentId,
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [pending, clusterChild] };
    store.selectedAgentId = { [SESSION_ID]: 'agent-1-child' };

    render(<WorkflowAdvanceRow session={session} />);

    expect(screen.getByTestId('workflow-advance-mounted')).toBeDefined();
  });
});
