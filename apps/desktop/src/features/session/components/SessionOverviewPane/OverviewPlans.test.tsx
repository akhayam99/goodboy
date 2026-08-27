// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Plan,
  PlanId,
  PlanStatus,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const state = vi.hoisted(() => ({
  sessionPlans: {} as Record<string, ReadonlyArray<Plan>>,
  setFocusedPlanId: vi.fn(),
}));

const attached = vi.hoisted(() => ({ runs: [] as ReadonlyArray<unknown> }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attached.runs,
}));

import { OverviewPlans } from './OverviewPlans';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const workflowId = 'workflow-1' as WorkflowId;
const liveRunId = 'run-live' as WorkflowRunId;
const discardedRunId = 'run-discarded' as WorkflowRunId;
const now = '2026-08-27T10:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: workflowId,
  workspaceId,
  name: 'Refactor',
  description: '',
  steps: [],
  createdAt: now,
  updatedAt: now,
};

const liveRun: WorkflowRun = {
  id: liveRunId,
  workflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
};

const discardedRun: WorkflowRun = {
  ...liveRun,
  id: discardedRunId,
  ordinal: 1,
  discardedAt: now,
};

const session = {
  id: sessionId,
  workspaceId,
  workflowRuns: [liveRun, discardedRun],
} as unknown as Session;

type MakePlanParams = {
  readonly id: string;
  readonly title: string;
  readonly status?: PlanStatus;
  readonly workflowRunId?: WorkflowRunId;
  readonly clusterCount?: number;
};

const makePlan = ({
  id,
  title,
  status = 'active',
  workflowRunId,
  clusterCount,
}: MakePlanParams): Plan => ({
  id: id as PlanId,
  sessionId,
  agentId: 'agent-1' as AgentId,
  title,
  bodyMd: 'Body',
  status,
  ...(workflowRunId != null ? { workflowRunId } : {}),
  ...(clusterCount != null
    ? {
        clusters: Array.from({ length: clusterCount }, (_, index) => ({
          title: `Cluster ${index + 1}`,
          instructions: `Implement cluster ${index + 1}`,
        })),
      }
    : {}),
  createdAt: now,
  updatedAt: now,
});

const agents: ReadonlyArray<Agent> = [];

afterEach(cleanup);

beforeEach(() => {
  attached.runs = [
    { run: liveRun, workflow },
    { run: discardedRun, workflow },
  ];
  state.sessionPlans = {};
  state.setFocusedPlanId.mockClear();
});

describe('OverviewPlans', () => {
  it('renders only active plans that are actionable now', () => {
    state.sessionPlans[sessionId] = [
      makePlan({
        id: 'plan-discarded',
        title: 'Discarded run plan',
        workflowRunId: discardedRunId,
      }),
      makePlan({ id: 'plan-runless', title: 'Runless plan' }),
      makePlan({ id: 'plan-live', title: 'Live run plan', workflowRunId: liveRunId }),
      makePlan({ id: 'plan-superseded', title: 'Superseded plan', status: 'superseded' }),
    ];

    render(<OverviewPlans session={session} agents={agents} onSelectLens={vi.fn()} />);

    expect(screen.queryByText('Discarded run plan')).toBeNull();
    expect(screen.getByText('Runless plan')).toBeDefined();
    expect(screen.getByText('Live run plan')).toBeDefined();
    expect(screen.queryByText('Superseded plan')).toBeNull();
  });

  it('shows one cluster chip only when clusters are present', () => {
    state.sessionPlans[sessionId] = [
      makePlan({ id: 'plan-clustered', title: 'Clustered plan', clusterCount: 4 }),
      makePlan({ id: 'plan-plain', title: 'Plain plan', clusterCount: 0 }),
    ];

    render(<OverviewPlans session={session} agents={agents} onSelectLens={vi.fn()} />);

    expect(screen.getByText('4 clusters')).toBeDefined();
    expect(screen.queryAllByText(/clusters?$/)).toHaveLength(1);
  });

  it('focuses the plan and opens the plans lens on click', () => {
    const plan = makePlan({ id: 'plan-live', title: 'Live run plan', workflowRunId: liveRunId });
    const onSelectLens = vi.fn();
    state.sessionPlans[sessionId] = [plan];

    render(<OverviewPlans session={session} agents={agents} onSelectLens={onSelectLens} />);
    fireEvent.click(screen.getByRole('button', { name: 'Live run plan' }));

    expect(state.setFocusedPlanId).toHaveBeenCalledWith(sessionId, plan.id);
    expect(onSelectLens).toHaveBeenCalledWith('plans');
  });
});
