import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { isRunSettled } from './isRunSettled';

const NOW = '2026-08-31T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_ID = 'step-1' as StepId;
const AGENT_ID = 'agent-1' as AgentId;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Ship it',
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
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: STEP_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Implement',
  status,
});

describe('isRunSettled', () => {
  it('settles a dynamic run once the orchestration outcome is done', () => {
    expect(
      isRunSettled({
        run: run({ executionMode: 'dynamic', orchestrationOutcome: 'done' }),
        workflow,
        agents: [],
      }),
    ).toBe(true);
  });

  it('leaves a dynamic run unsettled while no outcome is persisted', () => {
    expect(
      isRunSettled({
        run: run({ executionMode: 'dynamic' }),
        workflow,
        agents: [stepAgent('completed')],
      }),
    ).toBe(false);
  });

  it('leaves a dynamic run unsettled when the orchestration ended blocked', () => {
    expect(
      isRunSettled({
        run: run({ executionMode: 'dynamic', orchestrationOutcome: 'blocked' }),
        workflow,
        agents: [],
      }),
    ).toBe(false);
  });

  it('settles a static run when every step agent settled', () => {
    expect(isRunSettled({ run: run(), workflow, agents: [stepAgent('completed')] })).toBe(true);
  });

  it('leaves a static run unsettled while a step agent is pending', () => {
    expect(isRunSettled({ run: run(), workflow, agents: [stepAgent('pending')] })).toBe(false);
  });

  it('leaves a static run unsettled when its workflow cannot be resolved', () => {
    expect(isRunSettled({ run: run(), workflow: null, agents: [stepAgent('completed')] })).toBe(
      false,
    );
  });
});
