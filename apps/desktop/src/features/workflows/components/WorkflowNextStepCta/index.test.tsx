// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { WorkflowNextStepCta, pickNextWorkflowStep } from './index';

afterEach(cleanup);

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 't-1' as SessionId;
const WF_ID = 'wf' as WorkflowId;
const NOW = '2026-05-10T00:00:00.000Z' as IsoDateTime;

function wf(): Workflow {
  return {
    id: WF_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: '',
    steps: [
      { id: 's1' as StepId, workflowId: WF_ID, ordinal: 0, name: 'Scout', promptPrefix: '' },
      { id: 's2' as StepId, workflowId: WF_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
      { id: 's3' as StepId, workflowId: WF_ID, ordinal: 2, name: 'Refactor', promptPrefix: '' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function run(stepId: StepId, status: Agent['status'], idx = 0): Agent {
  return {
    id: `r-${idx}` as AgentId,
    sessionId: SESSION_ID,
    stepId,
    ordinal: idx,
    name: stepId,
    status,
  };
}

function preCreated(...statuses: Agent['status'][]): Agent[] {
  const stepIds = ['s1', 's2', 's3'] as const;
  return statuses.map((status, i) => run(stepIds[i] as StepId, status, i));
}

describe('pickNextWorkflowStep', () => {
  it('returns first step when all pre-created agents are pending', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('pending', 'pending', 'pending'))?.id).toBe('s1');
  });

  it('returns null while current step is running', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('running', 'pending', 'pending'))).toBeNull();
  });

  it('advances to next step once previous one is completed', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('completed', 'pending', 'pending'))?.id).toBe(
      's2',
    );
  });

  it('skips ahead past multiple completed steps to the next pending one', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('completed', 'completed', 'pending'))?.id).toBe(
      's3',
    );
  });

  it('returns null when all steps are completed', () => {
    expect(
      pickNextWorkflowStep(wf(), preCreated('completed', 'completed', 'completed')),
    ).toBeNull();
  });

  it('returns null when an earlier step failed (cannot advance over failure)', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('failed', 'pending', 'pending'))).toBeNull();
  });

  it('treats skipped steps as done for advancement', () => {
    expect(pickNextWorkflowStep(wf(), preCreated('skipped', 'pending', 'pending'))?.id).toBe('s2');
  });

  it('returns null when open questions are pending, even if otherwise actionable', () => {
    const runs = preCreated('completed', 'pending', 'pending');
    expect(pickNextWorkflowStep(wf(), runs, { hasOpenQuestions: true })).toBeNull();
  });

  it('returns null while summarizer is busy', () => {
    const runs = preCreated('completed', 'pending', 'pending');
    expect(pickNextWorkflowStep(wf(), runs, { summarizerBusy: true })).toBeNull();
  });

  it('allows advancement when gate flags are explicitly false', () => {
    const runs = preCreated('completed', 'pending', 'pending');
    expect(
      pickNextWorkflowStep(wf(), runs, { hasOpenQuestions: false, summarizerBusy: false })?.id,
    ).toBe('s2');
  });
});

describe('WorkflowNextStepCta', () => {
  const ctaRuns: Agent[] = [run('s1' as StepId, 'pending', 0), run('s2' as StepId, 'pending', 1)];

  it('calls onAdvance with the next step when clicked', async () => {
    const onAdvance = vi.fn();
    render(<WorkflowNextStepCta workflow={wf()} runs={ctaRuns} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));
    await Promise.resolve();
    expect(onAdvance).toHaveBeenCalled();
    expect(onAdvance.mock.calls[0]?.[0]).toMatchObject({ id: 's1' });
  });

  it('names what blocks it and asks for confirmation when questions are open', () => {
    const onAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={wf()}
        runs={ctaRuns}
        onAdvance={onAdvance}
        blockReason="questions"
      />,
    );
    expect(screen.getByTestId('workflow-next-step-blocked')).toBeDefined();
    expect(screen.getByTestId('workflow-next-step-cta').getAttribute('title')).toMatch(
      /open questions are waiting/i,
    );
    expect(
      screen.getByRole('button', {
        name: /run next step: scout.*blocked: open questions are waiting/i,
      }),
    ).toBeDefined();
    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));
    expect(screen.getByText(/start the next agent anyway/i)).toBeDefined();
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('warns and confirms before advancing while the predecessor turn is running', async () => {
    const onAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={wf()}
        runs={preCreated('completed', 'pending', 'pending')}
        onAdvance={onAdvance}
        blockReason="turn-running"
      />,
    );

    const cta = screen.getByTestId('workflow-next-step-cta');
    expect(cta.className).toContain('border-warning');
    expect(cta.className).not.toContain('border-primary');
    fireEvent.click(cta);
    expect(screen.getByText(/start the next agent anyway/i)).toBeDefined();
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'start anyway' }));
    await Promise.resolve();
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance.mock.calls[0]?.[0]).toMatchObject({ id: 's2' });
  });

  it('uses the primary tone when predecessors and gates are clear', () => {
    render(
      <WorkflowNextStepCta
        workflow={wf()}
        runs={preCreated('completed', 'pending', 'pending')}
        onAdvance={vi.fn()}
      />,
    );

    const cta = screen.getByTestId('workflow-next-step-cta');
    expect(cta.className).toContain('border-primary');
    expect(cta.className).not.toContain('border-warning');
  });

  it('names the next step explicitly', () => {
    render(<WorkflowNextStepCta workflow={wf()} runs={ctaRuns} onAdvance={vi.fn()} />);
    expect(screen.getByTestId('workflow-next-step-cta').textContent).toMatch(
      /run next step: scout/i,
    );
  });

  it('renders force CTA when chain is blocked (failed predecessor)', () => {
    const blockedRuns: Agent[] = [
      run('s1' as StepId, 'failed', 0),
      run('s2' as StepId, 'pending', 1),
    ];
    const onAdvance = vi.fn();
    const onForceAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={wf()}
        runs={blockedRuns}
        onAdvance={onAdvance}
        onForceAdvance={onForceAdvance}
      />,
    );
    expect(screen.getByTestId('workflow-force-next-step-cta')).toBeDefined();
    expect(screen.queryByTestId('workflow-next-step-cta')).toBeNull();
  });

  it('shows confirmation before executing force advance', async () => {
    const blockedRuns: Agent[] = [
      run('s1' as StepId, 'failed', 0),
      run('s2' as StepId, 'pending', 1),
    ];
    const onForceAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={wf()}
        runs={blockedRuns}
        onAdvance={vi.fn()}
        onForceAdvance={onForceAdvance}
      />,
    );
    fireEvent.click(screen.getByTestId('workflow-force-next-step-cta'));
    expect(screen.getByText(/skip the blocked step/i)).toBeDefined();
    expect(onForceAdvance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'skip and continue' }));
    await Promise.resolve();
    expect(onForceAdvance).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when workflow is complete', () => {
    const doneRuns: Agent[] = [
      run('s1' as StepId, 'completed', 0),
      run('s2' as StepId, 'completed', 1),
      run('s3' as StepId, 'completed', 2),
    ];
    const { container } = render(
      <WorkflowNextStepCta workflow={wf()} runs={doneRuns} onAdvance={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
