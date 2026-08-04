// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  IsoDateTime,
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
};

const renderStatus = ({ runOverride }: RenderParams) =>
  render(
    <WorkflowRunStatus
      run={runOverride}
      workflow={workflow}
      agents={EMPTY_AGENTS}
      predecessorName=""
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
});
