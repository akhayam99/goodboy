// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_AT, PLAN_FIXTURE_SESSION, aPlan } from '../../../../test/planFixtures';
import {
  PLAN_RUN_ID,
  aPlanDraft,
  aPlannerQuestion,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { PlanCommentsProvider } from './PlanCommentsProvider';

type Stubs = Partial<
  Pick<ReturnType<typeof useAppStore.getState>, 'approveWorkflowRunPlan' | 'sendArtifactComments'>
>;

const renderProvider = ({
  seed,
  stubs = {},
  onSent,
}: {
  readonly seed: PlanDrawerSeed;
  readonly stubs?: Stubs;
  readonly onSent?: Parameters<typeof PlanCommentsProvider>[0]['onSent'];
}) => {
  const { plan } = seedPlanDrawer(seed);
  useAppStore.setState(stubs);
  return render(
    <ToastProvider>
      <PlanCommentsProvider
        sessionId={PLAN_FIXTURE_SESSION}
        plan={{ ...aPlan(), ...plan }}
        onSent={onSent}
      >
        <p>the plan</p>
      </PlanCommentsProvider>
    </ToastProvider>,
  );
};

afterEach(cleanup);

describe('PlanCommentsProvider', () => {
  it('shows Approve in the bar with no comment when the run waits on the plan', () => {
    renderProvider({ seed: { run: 'held' } });

    const bar = screen.getByTestId('plan-comment-bar');
    expect(within(bar).getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(within(bar).queryByRole('button', { name: 'Send to planner' })).toBeNull();
  });

  it('shows no bar for a plan nothing waits on and nobody commented', () => {
    renderProvider({ seed: { run: 'none' } });

    expect(screen.queryByTestId('plan-comment-bar')).toBeNull();
  });

  it('shows no bar for a plan the run feeds on its own and nobody commented', () => {
    renderProvider({ seed: { run: 'feeding' } });

    expect(screen.queryByTestId('plan-comment-bar')).toBeNull();
  });

  it('keeps Approve away while the planner revises', () => {
    renderProvider({
      seed: {
        run: 'held',
        turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
      },
    });

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('approves the held run from the bar without asking when nothing is unsent', async () => {
    const approve = vi.fn(async () => ({
      kind: 'approved' as const,
      next: 'continues' as const,
      agentId: null,
    }));
    renderProvider({ seed: { run: 'held' }, stubs: { approveWorkflowRunPlan: approve } });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_RUN_ID));
    expect(await screen.findByText('Plan approved')).toBeDefined();
  });

  it('asks first when comments are unsent, and approves once confirmed', async () => {
    const approve = vi.fn(async () => ({
      kind: 'approved' as const,
      next: 'continues' as const,
      agentId: null,
    }));
    renderProvider({
      seed: { run: 'held', drafts: [aPlanDraft()] },
      stubs: { approveWorkflowRunPlan: approve },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Approve anyway' }));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
  });

  it('tells the page what the planner did after Send', async () => {
    const onSent = vi.fn();
    renderProvider({
      seed: { run: 'held', drafts: [aPlanDraft()] },
      stubs: { sendArtifactComments: vi.fn(async () => ({ kind: 'unchanged' as const })) },
      onSent,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send to planner' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ kind: 'unchanged' }));
  });

  it('makes Send wait while the planner has a question open', () => {
    renderProvider({
      seed: { run: 'held', drafts: [aPlanDraft()], questions: [aPlannerQuestion()] },
    });

    expect(screen.getByRole('button', { name: 'Send to planner' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByTestId('plan-comment-note').textContent).toBe(
      'The planner asked a question. Answer it first.',
    );
  });
});
