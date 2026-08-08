// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { WorkflowRunStatus } from './WorkflowRunStatus';

const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Refactor',
  description: '',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
};

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

type RenderParams = {
  readonly runOverride: WorkflowRun;
  readonly hasOrchestratorStrip?: boolean;
  readonly predecessorName?: string;
};

const renderStatus = ({
  runOverride,
  hasOrchestratorStrip = false,
  predecessorName = '',
}: RenderParams) =>
  render(
    <WorkflowRunStatus
      run={runOverride}
      workflow={workflow}
      agents={EMPTY_AGENTS}
      predecessorName={predecessorName}
      hasOrchestratorStrip={hasOrchestratorStrip}
    />,
  );

afterEach(cleanup);

describe('WorkflowRunStatus', () => {
  it('marks a budget stop as a pause instead of an orchestrator failure', () => {
    renderStatus({
      runOverride: { ...run, orchestrationStop: { kind: 'budget', message: 'any wording' } },
    });

    expect(screen.getByTestId('workflow-orchestrator-budget-paused').textContent).toContain(
      'Budget paused',
    );
    expect(screen.queryByTestId('workflow-orchestrator-failed')).toBeNull();
  });

  it('marks a failed decision as an orchestrator failure', () => {
    renderStatus({
      runOverride: { ...run, orchestrationStop: { kind: 'failure', message: 'usage limit' } },
    });

    expect(screen.getByTestId('workflow-orchestrator-failed').getAttribute('title')).toBe(
      'usage limit',
    );
    expect(screen.queryByTestId('workflow-orchestrator-budget-paused')).toBeNull();
  });

  it('never reads an operator stop as an orchestrator failure', () => {
    renderStatus({
      runOverride: { ...run, orchestrationStop: { kind: 'operator', message: 'you stopped it' } },
    });

    expect(screen.getByTestId('workflow-orchestrator-stopped').textContent).toContain('Stopped');
    expect(screen.queryByTestId('workflow-orchestrator-failed')).toBeNull();
  });

  it('says a run was stopped even while an agent still reads as running', () => {
    const stillRunning: ReadonlyArray<Agent> = [
      {
        id: 'agent-1' as AgentId,
        sessionId: 'session-1' as SessionId,
        workflowRunId: RUN_ID,
        ordinal: 0,
        name: 'Implement',
        status: 'running',
      },
    ];
    render(
      <WorkflowRunStatus
        run={{ ...run, orchestrationStop: { kind: 'operator', message: 'you stopped it' } }}
        workflow={workflow}
        agents={stillRunning}
        predecessorName=""
      />,
    );

    expect(screen.getByTestId('workflow-orchestrator-stopped')).toBeDefined();
    expect(screen.queryByText('Running')).toBeNull();
  });

  it('never calls a paused run ready when the strip already owns the phase', () => {
    const { container } = renderStatus({
      runOverride: { ...run, orchestrationStop: { kind: 'budget', message: 'any wording' } },
      hasOrchestratorStrip: true,
    });

    expect(container.textContent).toBe('');
  });

  it('never calls a failed run ready when the strip already owns the phase', () => {
    const { container } = renderStatus({
      runOverride: { ...run, orchestrationStop: { kind: 'failure', message: 'usage limit' } },
      hasOrchestratorStrip: true,
    });

    expect(container.textContent).toBe('');
  });

  it('keeps the run outcome next to the strip', () => {
    renderStatus({
      runOverride: { ...run, orchestrationOutcome: 'done' },
      hasOrchestratorStrip: true,
    });

    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('keeps the chained gate the strip cannot show', () => {
    renderStatus({
      runOverride: { ...run, triggerMode: 'after_run' },
      hasOrchestratorStrip: true,
      predecessorName: 'Scout',
    });

    expect(screen.getByTitle('After Scout')).toBeDefined();
  });
});
