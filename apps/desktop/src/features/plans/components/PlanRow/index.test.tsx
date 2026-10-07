// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PlanArtifact, PlanWithCount, ProviderRunId, TurnState } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  PLAN_FIXTURE_AT,
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../../test/planFixtures';
import { PLAN_RUN_ID, aPlanDraft, seedPlanDrawer } from '../../../../test/planDrawerFixtures';
import { PlanRow } from './index';

const seed = ({
  planOverrides = {},
  storedOverrides = {},
  turn = { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
}: {
  readonly planOverrides?: Partial<PlanWithCount>;
  readonly storedOverrides?: Partial<PlanArtifact>;
  readonly turn?: TurnState;
}) => {
  const plan = aPlan(planOverrides);
  useAppStore.setState({
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan(storedOverrides, plan)] },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [
        anAgent({ id: PLAN_FIXTURE_PLANNER, sessionId: PLAN_FIXTURE_SESSION, name: 'Planner' }),
      ],
    },
    sessionOpenQuestions: {},
    agentTurnState: { [PLAN_FIXTURE_PLANNER]: turn },
    drawer: null,
  });
};

const renderRow = () =>
  render(
    <ToastProvider>
      <PlanRow sessionId={PLAN_FIXTURE_SESSION} planId={PLAN_FIXTURE_ID} />
    </ToastProvider>,
  );

const running = (runId: string): TurnState => ({
  kind: 'running',
  runId: runId as ProviderRunId,
  startedAt: PLAN_FIXTURE_AT,
});

beforeEach(() => {
  useAppStore.setState({ drawer: null });
});

afterEach(cleanup);

describe('PlanRow', () => {
  it('spans the column and says plan, title, version and state', () => {
    seed({ storedOverrides: { revision: 2 } });
    renderRow();

    const row = screen.getByTestId('plan-row');
    expect(row.getAttribute('data-span')).toBe('column');
    expect(row.textContent).toContain('Plan · Retry-safe webhook credits');
    expect(row.textContent).toContain('v2');
    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Ready to run');
  });

  it('opens the plan in the drawer and leaves the address alone', () => {
    seed({});
    const before = useAppStore.getState().currentSessionId;
    renderRow();

    fireEvent.click(screen.getByTestId('plan-row-open'));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(useAppStore.getState().currentSessionId).toBe(before);
  });

  it('says Revising to the next version and blocks Run plan with the reason', () => {
    seed({ storedOverrides: { revision: 1 }, turn: running('run-2') });
    renderRow();

    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Revising to v2');
    const run = screen.getByTestId('plan-primary');
    expect(run.hasAttribute('disabled')).toBe(true);
    expect(run.getAttribute('title')).toBe('The planner is revising this plan');
  });

  it('keeps the same frame when the revision settles and Run plan comes back', () => {
    seed({ storedOverrides: { revision: 2, sourceTurnId: 'run-2' } });
    renderRow();

    expect(screen.getByTestId('plan-primary').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('plan-row').getAttribute('data-span')).toBe('column');
  });

  it('leaves a plan that ran as Ran and says a new version is being written', () => {
    seed({
      planOverrides: { status: 'consumed', consumptionCount: 1 },
      storedOverrides: { status: 'consumed' },
      turn: running('run-2'),
    });
    renderRow();

    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Ran');
    expect(screen.getByTestId('plan-row-new-version').textContent).toContain(
      'Writing a new version',
    );
    expect(screen.queryByTestId('plan-primary')).toBeNull();
  });
});

describe('PlanRow primary for a plan that belongs to a run', () => {
  it('is Approve, filled, when the run waits on the plan, and approves the run', async () => {
    seedPlanDrawer({ run: 'held' });
    const approve = vi.fn(async () => ({
      kind: 'approved' as const,
      next: 'continues' as const,
      agentId: null,
    }));
    useAppStore.setState({ approveWorkflowRunPlan: approve });
    renderRow();

    const primary = screen.getByTestId('plan-primary');
    expect(primary.textContent).toBe('Approve');
    expect(primary.getAttribute('data-filled')).toBe('true');
    fireEvent.click(primary);

    await waitFor(() => expect(approve).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_RUN_ID));
  });

  it('asks under the row about unsent comments before it approves', () => {
    seedPlanDrawer({ run: 'held', drafts: [aPlanDraft()] });
    const approve = vi.fn();
    useAppStore.setState({ approveWorkflowRunPlan: approve });
    renderRow();

    fireEvent.click(screen.getByTestId('plan-primary'));

    expect(approve).not.toHaveBeenCalled();
    expect(
      screen.getByRole('group', { name: '1 comment is not sent. Approve anyway?' }),
    ).toBeDefined();
    expect(screen.getByTestId('plan-primary').getAttribute('data-filled')).toBe('false');
  });

  it('is Run plan for a session plan', () => {
    seedPlanDrawer({ run: 'none' });
    renderRow();

    expect(screen.getByTestId('plan-primary').textContent).toBe('Run plan');
  });
});
