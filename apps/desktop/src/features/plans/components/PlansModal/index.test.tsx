// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
    loadConsumptionsForPlan: vi.fn(async () => undefined),
    updatePlanBody: vi.fn(async () => undefined),
    deletePlan: vi.fn(async () => undefined),
    restorePlan: vi.fn(async () => undefined),
    runPlan: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    plans: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionPlans: () => state.plans,
}));

beforeEach(() => {
  state.sessionPhaseRuns = {};
  state.planConsumptions = {};
  state.plans = [];
});
afterEach(cleanup);

import { PlansModal } from './index';

describe('PlansModal', () => {
  it('renders the Plans dialog title when open', () => {
    render(<PlansModal sessionId={'sess-1' as never} open onClose={vi.fn()} />);
    expect(screen.getByText(/^Plans$/)).toBeDefined();
  });

  it('shows the No plans yet copy when the list is empty', () => {
    render(<PlansModal sessionId={'sess-1' as never} open onClose={vi.fn()} />);
    expect(screen.getByText(/no plans yet/i)).toBeDefined();
  });

  it('shows the No plan selected placeholder when nothing is selected', () => {
    render(<PlansModal sessionId={'sess-1' as never} open onClose={vi.fn()} />);
    expect(screen.getByText(/no plan selected/i)).toBeDefined();
  });
});
