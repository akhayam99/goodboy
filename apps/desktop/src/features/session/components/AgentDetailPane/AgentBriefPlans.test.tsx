// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ArtifactId, PlanWithCount } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../../test/planFixtures';
import { AgentBriefPlans } from './AgentBriefPlans';

const seed = (plans: ReadonlyArray<PlanWithCount>) => {
  useAppStore.setState({
    sessionPlans: { [PLAN_FIXTURE_SESSION]: plans },
    sessionArtifacts: {
      [PLAN_FIXTURE_SESSION]: plans.map((plan) => aStoredPlan({}, plan)),
    },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [
        anAgent({ id: PLAN_FIXTURE_PLANNER, sessionId: PLAN_FIXTURE_SESSION, name: 'Planner' }),
      ],
    },
    sessionOpenQuestions: {},
    agentTurnState: {},
    drawer: null,
  });
};

const renderBrief = (plans: ReadonlyArray<PlanWithCount>) =>
  render(
    <ToastProvider>
      <AgentBriefPlans plans={plans} sessionId={PLAN_FIXTURE_SESSION} />
    </ToastProvider>,
  );

beforeEach(() => seed([]));

afterEach(cleanup);

describe('AgentBriefPlans', () => {
  it('renders nothing when there are no plans', () => {
    const { container } = renderBrief([]);

    expect(container.firstChild).toBeNull();
  });

  it('shows each plan as a row on the column with its state', () => {
    const plans = [
      aPlan({ title: 'Implement chat surface' }),
      aPlan({ id: 'plan-2' as ArtifactId, title: 'Backfill keys', status: 'consumed' }),
    ];
    seed(plans);
    renderBrief(plans);

    const rows = screen.getAllByTestId('plan-row');
    expect(rows.map((row) => row.getAttribute('data-span'))).toEqual(['column', 'column']);
    expect(rows[0]?.textContent).toContain('Plan · Implement chat surface');
    expect(rows[0]?.textContent).toContain('Ready to run');
    expect(rows[1]?.textContent).toContain('Ran');
  });

  it('opens the plan in the drawer without leaving the agent', () => {
    const plans = [aPlan({ title: 'Implement chat surface' })];
    seed(plans);
    renderBrief(plans);

    fireEvent.click(screen.getByRole('button', { name: /Open plan Implement chat surface/ }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
  });
});
