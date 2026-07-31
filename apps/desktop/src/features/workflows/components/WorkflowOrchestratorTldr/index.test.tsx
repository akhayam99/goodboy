// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Step, StepId, WorkflowId } from '@goodboy/types';
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

describe('WorkflowOrchestratorTldr', () => {
  it('renders nothing when no step carries a reason', () => {
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
});
