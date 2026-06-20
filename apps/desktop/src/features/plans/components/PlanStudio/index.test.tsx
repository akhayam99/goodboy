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

import { PlanStudio } from './index';

describe('PlanStudio', () => {
  it('renders the Plans title', () => {
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('Plans')).toBeDefined();
  });

  it('shows No plans yet when the list is empty', () => {
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText(/no plans yet/i)).toBeDefined();
  });

  it('shows No plan selected placeholder when nothing is selected', () => {
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText(/no plan selected/i)).toBeDefined();
  });

  it('renders plan list items and status pills when plans exist', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Implement auth module',
        bodyMd: '## Steps\n- Step one',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('Implement auth module')).toBeDefined();
    expect(screen.getByText(/active/i)).toBeDefined();
  });
});

describe('PlanStudio subpage', () => {
  it('fills the pane (relative, not a fixed overlay)', () => {
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('relative');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-50');
  });

  it('selects initial plan by id when initialPlanId is provided', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'First plan',
        bodyMd: 'body one',
        status: 'consumed',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 1,
      },
      {
        id: 'plan-2',
        agentId: 'agent-2',
        sessionId: 'sess-1',
        title: 'Second plan',
        bodyMd: 'body two',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        runCount: 0,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} initialPlanId={'plan-2' as never} />);
    expect(screen.getByText('body two')).toBeDefined();
  });

  it('auto-selects the last plan when no initialPlanId is given', () => {
    state.plans = [
      {
        id: 'plan-a',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Alpha plan',
        bodyMd: 'alpha body',
        status: 'consumed',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 1,
      },
      {
        id: 'plan-b',
        agentId: 'agent-2',
        sessionId: 'sess-1',
        title: 'Beta plan',
        bodyMd: 'beta body',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        runCount: 0,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('beta body')).toBeDefined();
  });
});
