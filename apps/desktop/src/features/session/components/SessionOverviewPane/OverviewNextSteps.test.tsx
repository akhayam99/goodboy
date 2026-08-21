// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const state = vi.hoisted(() => ({
  summarizerStatus: {} as Record<string, unknown>,
  agentTurnState: {} as Record<string, unknown>,
  agentModelOverride: {} as Record<string, string>,
  agentProviderOverride: {} as Record<string, string>,
  agentEffortOverride: {} as Record<string, string>,
  activateWorkflowAgent: vi.fn(async () => undefined),
  emitNotification: vi.fn(),
}));

const attached = vi.hoisted(() => ({ runs: [] as ReadonlyArray<unknown> }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => [],
}));

vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attached.runs,
}));

vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));

import { OverviewNextSteps } from './OverviewNextSteps';

const workspaceId = 'ws-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const workflowId = 'wf-1' as WorkflowId;
const runId = 'run-1' as WorkflowRunId;
const now = '2026-08-20T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: workflowId,
  workspaceId,
  name: 'Refactor',
  description: '',
  steps: [
    { id: 's1' as StepId, workflowId, ordinal: 0, name: 'Scout', promptPrefix: '' },
    { id: 's2' as StepId, workflowId, ordinal: 1, name: 'Plan', promptPrefix: '' },
  ],
  createdAt: now,
  updatedAt: now,
};

const run: WorkflowRun = {
  id: runId,
  workflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
};

const session = { id: sessionId, workspaceId, workflowRuns: [run] } as unknown as Session;

const stepAgent = (stepId: StepId, status: Agent['status'], index: number): Agent =>
  ({
    id: `agent-${index}` as AgentId,
    sessionId,
    workflowRunId: runId,
    stepId,
    ordinal: index,
    name: stepId,
    status,
  }) as Agent;

const betweenSteps: ReadonlyArray<Agent> = [
  stepAgent('s1' as StepId, 'completed', 0),
  stepAgent('s2' as StepId, 'pending', 1),
];

afterEach(cleanup);

beforeEach(() => {
  attached.runs = [{ run, workflow }];
  state.summarizerStatus = {};
  state.agentTurnState = {};
  state.activateWorkflowAgent.mockClear();
});

describe('OverviewNextSteps', () => {
  it('offers the next step from the overview while the run waits between steps', () => {
    render(<OverviewNextSteps session={session} agents={betweenSteps} />);

    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
    expect(screen.getByText('Run next step: Plan')).toBeDefined();
  });

  it('starts the agent waiting on that step', async () => {
    render(<OverviewNextSteps session={session} agents={betweenSteps} />);

    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));
    await vi.waitFor(() => expect(state.activateWorkflowAgent).toHaveBeenCalledTimes(1));

    expect(state.activateWorkflowAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, agentId: 'agent-1' }),
    );
  });

  it('says nothing while a step is still running', () => {
    render(
      <OverviewNextSteps
        session={session}
        agents={[stepAgent('s1' as StepId, 'running', 0), stepAgent('s2' as StepId, 'pending', 1)]}
      />,
    );

    expect(screen.queryByTestId('workflow-next-step-cta')).toBeNull();
    expect(screen.queryByLabelText('Up next')).toBeNull();
  });

  it('says nothing once every step is done', () => {
    render(
      <OverviewNextSteps
        session={session}
        agents={[
          stepAgent('s1' as StepId, 'completed', 0),
          stepAgent('s2' as StepId, 'completed', 1),
        ]}
      />,
    );

    expect(screen.queryByTestId('workflow-next-step-cta')).toBeNull();
  });
});
