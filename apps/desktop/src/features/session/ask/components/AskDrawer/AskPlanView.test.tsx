// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { DrawerColumn, DrawerFrame } from '@goodboy/ui';
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

type ColumnParams = {
  readonly isParked: boolean;
  readonly isPlanShown: boolean;
  readonly onClose: () => void;
  readonly onBack: () => void;
};

const askColumn = ({ isParked, isPlanShown, onClose, onBack }: ColumnParams) => (
  <DrawerColumn
    main={<div>Tasks</div>}
    drawer={
      <DrawerFrame title="Ask" onClose={onClose}>
        {isPlanShown ? (
          <AskPlanView
            sessionId={PLAN_FIXTURE_SESSION}
            artifactId={PLAN_FIXTURE_ID}
            onBack={onBack}
          />
        ) : (
          <p>ledger-core thread</p>
        )}
      </DrawerFrame>
    }
    isParked={isParked}
    ariaLabel="Side panel"
    resizeLabel="Resize side panel"
  />
);

describe('the plan inside Ask after a page round trip', () => {
  it('goes back to the thread on Esc instead of closing Ask', () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    const view = render(askColumn({ isParked: false, isPlanShown: false, onClose, onBack }));
    view.rerender(askColumn({ isParked: false, isPlanShown: true, onClose, onBack }));
    view.rerender(askColumn({ isParked: true, isPlanShown: true, onClose, onBack }));
    view.rerender(askColumn({ isParked: false, isPlanShown: true, onClose, onBack }));

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
