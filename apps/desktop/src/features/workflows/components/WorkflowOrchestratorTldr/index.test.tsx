// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Step,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowOrchestrationOutcome,
} from '@goodboy/types';
import { WorkflowOrchestratorTldr } from './index';

afterEach(cleanup);

const WF_ID = 'wf-1' as WorkflowId;

const step = (ordinal: number, name: string, orchestratorReason?: string): Step =>
  ({
    id: `s-${ordinal}` as StepId,
    workflowId: WF_ID,
    ordinal,
    name,
    promptPrefix: '',
    ...(orchestratorReason != null && { orchestratorReason }),
  }) as Step;

const run = (outcome: WorkflowOrchestrationOutcome, orchestrationReason?: string): WorkflowRun =>
  ({
    id: 'run-1' as WorkflowRunId,
    workflowId: WF_ID,
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'dynamic',
    orchestrationOutcome: outcome,
    ...(orchestrationReason != null && { orchestrationReason }),
  }) as WorkflowRun;

describe('WorkflowOrchestratorTldr', () => {
  it('renders nothing when no step carries a reason and the run has no outcome', () => {
    const { container } = render(<WorkflowOrchestratorTldr steps={[step(0, 'Scout')]} />);

    expect(container.innerHTML).toBe('');
  });

  it('lists one compact line per decided step', () => {
    render(
      <WorkflowOrchestratorTldr
        steps={[
          step(0, 'Scout', 'the codebase is unknown'),
          step(1, 'Implement', 'the plan is settled'),
        ]}
      />,
    );

    expect(screen.getByText('Scout')).toBeDefined();
    expect(screen.getByText('the codebase is unknown')).toBeDefined();
    expect(screen.getByText('Implement')).toBeDefined();
  });

  it('keeps the tail visible and reveals the earlier decisions on demand', () => {
    render(
      <WorkflowOrchestratorTldr
        steps={[
          step(0, 'Scout', 'first reason'),
          step(1, 'Plan', 'second reason'),
          step(2, 'Implement', 'third reason'),
          step(3, 'Review', 'fourth reason'),
        ]}
      />,
    );

    expect(screen.queryByText('first reason')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'show 1 earlier' }));

    expect(screen.getByText('first reason')).toBeDefined();
  });

  it('expands a step row into the full reason without truncation', () => {
    const reason = 'the scout report left the data model open, so a plan step comes first';
    render(<WorkflowOrchestratorTldr steps={[step(0, 'Scout', reason)]} />);

    expect(screen.getByText(reason).className).toContain('truncate');

    fireEvent.click(screen.getByRole('button', { name: 'Why Scout' }));

    const full = screen.getByText(reason);
    expect(full.className).not.toContain('truncate');
    expect(full.getAttribute('title')).toBeNull();
  });

  it('collapses an expanded step row again', () => {
    render(<WorkflowOrchestratorTldr steps={[step(0, 'Scout', 'a long rationale')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Why Scout' }));

    fireEvent.click(screen.getByRole('button', { expanded: true }));

    expect(screen.getByText('a long rationale').className).toContain('truncate');
  });

  it('closes the list with why the run ended, expandable like the step rows', () => {
    render(
      <WorkflowOrchestratorTldr
        steps={[step(0, 'Scout', 'the codebase is unknown')]}
        run={run('blocked', 'the migration needs a human call')}
      />,
    );

    const closing = screen.getByTestId('workflow-orchestrator-closing');
    expect(closing.textContent).toContain('stopped, needs a human call');

    fireEvent.click(screen.getByRole('button', { name: /why the run ended/i }));

    expect(screen.getByText('the migration needs a human call').className).not.toContain(
      'truncate',
    );
  });

  it('omits the closing row when the run prop is absent or carries no reason', () => {
    render(<WorkflowOrchestratorTldr steps={[step(0, 'Scout', 'the codebase is unknown')]} />);
    expect(screen.queryByTestId('workflow-orchestrator-closing')).toBeNull();
    cleanup();

    render(
      <WorkflowOrchestratorTldr
        steps={[step(0, 'Scout', 'the codebase is unknown')]}
        run={run('done')}
      />,
    );
    expect(screen.queryByTestId('workflow-orchestrator-closing')).toBeNull();
  });
});
