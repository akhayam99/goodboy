// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../../store';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../../../test/planFixtures';
import { AskPlanView } from './AskPlanView';

const navigate = vi.fn();

beforeEach(() => {
  navigate.mockClear();
  const plan = aPlan();
  useAppStore.setState({
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan)] },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [
        anAgent({ id: PLAN_FIXTURE_PLANNER, sessionId: PLAN_FIXTURE_SESSION, name: 'Planner' }),
      ],
    },
    sessionOpenQuestions: {},
    agentTurnState: {},
    drawer: { kind: 'ask', sessionId: PLAN_FIXTURE_SESSION, payload: null },
    navigate,
  });
});

afterEach(cleanup);

describe('the plan inside Ask', () => {
  it('opens the plan in its drawer and never goes to the Artifacts page', () => {
    render(
      <AskPlanView
        sessionId={PLAN_FIXTURE_SESSION}
        artifactId={PLAN_FIXTURE_ID}
        onBack={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open in Artifacts' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open plan' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
