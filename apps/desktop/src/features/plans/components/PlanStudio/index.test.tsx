// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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
    setFocusedPlanId: vi.fn(),
    plans: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionPlans: () => state.plans,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

beforeEach(() => {
  state.sessionPhaseRuns = {};
  state.planConsumptions = {};
  state.plans = [];
  state.deletePlan.mockClear();
});
afterEach(cleanup);

import { PlanStudio } from './index';

describe('PlanStudio', () => {
  it('renders the Plans title as the pane heading', () => {
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeDefined();
  });

  it('shows No plans yet when the list is empty', () => {
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText(/no plans yet/i)).toBeDefined();
  });

  it('shows No plan selected placeholder when a plan exists but none is selected', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-deleted',
        sessionId: 'sess-1',
        title: 'Lonely plan',
        bodyMd: 'body',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} initialPlanId={'missing' as never} />);
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

  it('confirms before deleting an active plan', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Implement auth module',
        bodyMd: '## Steps',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} initialPlanId={'plan-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(state.deletePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Implement auth module' }));
    expect(state.deletePlan).toHaveBeenCalledWith('sess-1', 'plan-1');
  });
});

describe('PlanStudio subpage', () => {
  it('fills the pane (relative, not a fixed overlay)', () => {
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('relative');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-50');
    expect(container.querySelector('.max-w-5xl')).not.toBeNull();
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
    const { container } = render(
      <PlanStudio sessionId={'sess-1' as never} initialPlanId={'plan-2' as never} />,
    );
    expect(screen.getByText('body two')).toBeDefined();
    expect(container.querySelector('.max-w-5xl')).not.toBeNull();
  });

  it('renders no plan list and no CTA for a single plan', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Only plan',
        bodyMd: 'only body',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.queryByRole('button', { name: /other plans/i })).toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(screen.getByText('Only plan')).toBeDefined();
  });

  it('opens the other plans in a right panel and switches to the picked one', () => {
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
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);

    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(screen.getByText('beta body')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Other plans (1)' }));
    expect(container.querySelectorAll('li')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Show consumed (1)' }));
    expect(container.querySelectorAll('li')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /plan 2 consumed Alpha plan/i }));
    expect(screen.getByText('alpha body')).toBeDefined();
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('closes the plan list panel from its own close control', () => {
    state.plans = [
      {
        id: 'plan-a',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Alpha plan',
        bodyMd: 'alpha body',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
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
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Other plans (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close plan list' }));
    expect(container.querySelectorAll('li')).toHaveLength(0);
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
