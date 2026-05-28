// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, Step, Workflow } from '@goodboy/types';
import { WorkflowNextStepCta, pickNextWorkflowStep } from './index';

afterEach(cleanup);

const steps: Step[] = [
  { id: 's1', ordinal: 0, name: 'planner', role: 'plan', verbosity: undefined } as Step,
  { id: 's2', ordinal: 1, name: 'implementer', role: 'impl', verbosity: undefined } as Step,
];
const workflow: Workflow = { id: 'w1', name: 'wf', steps } as Workflow;

const pendingRuns: Agent[] = [
  { id: 'a1', stepId: 's1', status: 'pending' } as Agent,
  { id: 'a2', stepId: 's2', status: 'pending' } as Agent,
];

describe('pickNextWorkflowStep', () => {
  it('returns the first step whose pending agent is ready to advance', () => {
    expect(pickNextWorkflowStep(workflow, pendingRuns)?.id).toBe('s1');
  });

  it('returns null when the open-questions gate is on', () => {
    expect(pickNextWorkflowStep(workflow, pendingRuns, { hasOpenQuestions: true })).toBeNull();
  });
});

describe('WorkflowNextStepCta', () => {
  it('calls onAdvance with the next step when clicked', async () => {
    const onAdvance = vi.fn();
    render(<WorkflowNextStepCta workflow={workflow} runs={pendingRuns} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));
    await Promise.resolve();
    expect(onAdvance).toHaveBeenCalled();
    expect(onAdvance.mock.calls[0]?.[0]).toMatchObject({ id: 's1' });
  });

  it('asks for confirmation when there are open questions', () => {
    const onAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={workflow}
        runs={pendingRuns}
        onAdvance={onAdvance}
        hasOpenQuestions
      />,
    );
    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));
    expect(screen.getByText(/open questions need resolution/i)).toBeDefined();
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
