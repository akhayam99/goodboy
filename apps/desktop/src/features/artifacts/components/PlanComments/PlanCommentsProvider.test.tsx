// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_AT, PLAN_FIXTURE_SESSION, aPlan } from '../../../../test/planFixtures';
import {
  aPlanDraft,
  aPlannerQuestion,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { PlanCommentsProvider } from './PlanCommentsProvider';

type Stubs = Partial<Pick<ReturnType<typeof useAppStore.getState>, 'sendArtifactComments'>>;

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
  it('shows a hint and no button in the bar when the run waits and nobody commented', () => {
    renderProvider({ seed: { run: 'held' } });

    const bar = screen.getByTestId('plan-comment-bar');
    expect(within(bar).queryByRole('button')).toBeNull();
    expect(within(bar).getByText('Select text or click a block to comment')).toBeDefined();
  });

  it('never draws Approve in the bar, with comments or without', () => {
    renderProvider({ seed: { run: 'held', drafts: [aPlanDraft()] } });

    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
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

    const send = screen.getByRole('button', { name: 'Send to planner' });
    expect(send.hasAttribute('disabled')).toBe(true);
    expect(send.getAttribute('title')).toBe('The planner asked a question. Answer it first.');
    expect(screen.queryByTestId('plan-comment-note')).toBeNull();
  });
});
