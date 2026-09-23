import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  ClusterCompletionHold,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { isWorkflowRunComplete } from './isWorkflowRunComplete';
import { splitWorkflowRuns } from './activeWorkflowRuns';

const NOW = '2026-08-23T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_ID = 'step-1' as StepId;
const CONTAINER_ID = 'container-1' as AgentId;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Migrate modals',
  description: '',
  steps: [
    {
      id: STEP_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Implement',
      promptPrefix: '',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const run = (over: Partial<WorkflowRun> = {}): WorkflowRun =>
  ({
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    ordinal: 0,
    currentStep: 0,
    autoRun: true,
    triggerMode: 'immediate',
    executionMode: 'static',
    ...over,
  }) as WorkflowRun;

const stepAgent = (status: AgentStatus): Agent => ({
  id: CONTAINER_ID,
  sessionId: SESSION_ID,
  stepId: STEP_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Implement',
  status,
});

const clusterChild = (ordinal: number, status: AgentStatus): Agent => ({
  id: `child-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: CONTAINER_ID,
  ordinal,
  name: `cluster ${ordinal}`,
  status,
});

const holdOn = (state: ClusterCompletionHold['state']): ClusterCompletionHold => ({
  id: 'hold-1',
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  containerAgentId: CONTAINER_ID,
  sourceAgentId: 'child-1' as AgentId,
  sourceTurnId: 'turn-1',
  reason: 'unresolved-outcome',
  findings: [],
  state,
  resolutionEvidence: state === 'resolved' ? 'repair verified' : null,
  resolvedAt: state === 'resolved' ? NOW : null,
  createdAt: NOW,
  updatedAt: NOW,
});

describe('isWorkflowRunComplete', () => {
  it('reads a static run as complete when every step agent settled and no descendant is left', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'completed')],
        holds: [],
      }),
    ).toBe(true);
  });

  it('does not read a static run as complete while a cluster child is still pending', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'pending')],
        holds: [],
      }),
    ).toBe(false);
  });

  it('does not read a dynamic run as complete while a cluster child is still pending', () => {
    expect(
      isWorkflowRunComplete({
        run: run({ executionMode: 'dynamic', orchestrationOutcome: 'done' }),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'pending')],
        holds: [],
      }),
    ).toBe(false);
  });

  it('treats a skipped cluster child as settled', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'skipped')],
        holds: [],
      }),
    ).toBe(true);
  });

  it('does not let a transferred cluster child complete its container', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'transferred')],
        holds: [],
      }),
    ).toBe(false);
  });

  it('does not let a transferred cluster child complete its container while its hold is open', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'transferred')],
        holds: [holdOn('open')],
      }),
    ).toBe(false);
  });

  it('completes a run whose transferred cluster child finished its node through a resolved hold', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'transferred')],
        holds: [holdOn('resolved')],
      }),
    ).toBe(true);
  });

  it('never counts a resolved hold under another container for a transferred child', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('completed'), clusterChild(1, 'transferred')],
        holds: [{ ...holdOn('resolved'), containerAgentId: 'other-container' as AgentId }],
      }),
    ).toBe(false);
  });

  it('does not let a transferred step agent satisfy its step', () => {
    expect(
      isWorkflowRunComplete({
        run: run(),
        workflow,
        agents: [stepAgent('transferred')],
        holds: [],
      }),
    ).toBe(false);
  });
});

describe('splitWorkflowRuns', () => {
  const attachedRuns = [{ run: run(), workflow }];

  it('keeps a run active while one of its cluster children never ran', () => {
    const result = splitWorkflowRuns({
      attachedRuns,
      agents: [stepAgent('completed'), clusterChild(1, 'pending'), clusterChild(2, 'pending')],
      holds: [],
    });

    expect(result.completed).toHaveLength(0);
    expect(result.active).toHaveLength(1);
  });

  it('moves a run to completed once its transferred child finished its node through a hold', () => {
    const result = splitWorkflowRuns({
      attachedRuns,
      agents: [stepAgent('completed'), clusterChild(1, 'transferred')],
      holds: [holdOn('resolved')],
    });

    expect(result.completed).toHaveLength(1);
    expect(result.active).toHaveLength(0);
  });

  it('still exposes only step agents in agentsByRunId', () => {
    const result = splitWorkflowRuns({
      attachedRuns,
      agents: [stepAgent('completed'), clusterChild(1, 'completed')],
      holds: [],
    });

    expect(result.agentsByRunId.get(RUN_ID)?.map((agent) => agent.id)).toEqual([CONTAINER_ID]);
    expect(result.completed).toHaveLength(1);
  });
});
