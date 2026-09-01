// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const { state, showToast } = vi.hoisted(() => ({
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
    loadConsumptionsForPlan: vi.fn(async () => undefined),
    updatePlanBody: vi.fn(async () => undefined),
    deletePlan: vi.fn(async () => undefined),
    restorePlan: vi.fn(async () => undefined),
    runPlan: vi.fn(async () => 'agent-impl'),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    focusedPlanId: {} as Record<string, string | null>,
    setFocusedPlanId: vi.fn(),
    lensHistory: {} as Record<string, { readonly index: number }>,
    lensGo: vi.fn(),
    plans: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionPlans: () => state.plans,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

beforeEach(() => {
  showToast.mockClear();
  state.runPlan.mockClear();
  state.selectAgent.mockClear();
  state.setActiveLens.mockClear();
  state.setFocusedPlanId.mockClear();
  state.lensGo.mockClear();
  state.sessionPhaseRuns = {};
  state.planConsumptions = {};
  state.plans = [];
  state.focusedPlanId = {};
  state.lensHistory = {};
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

  it('falls through to the list when focusedPlanId matches no plan', () => {
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
    state.focusedPlanId = { 'sess-1': 'missing' };
    render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('Lonely plan')).toBeDefined();
    expect(screen.queryByText(/no plan selected/i)).toBeNull();
  });

  it('renders the focused plan title and status pill', () => {
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
    state.focusedPlanId = { 'sess-1': 'plan-1' };
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
    state.focusedPlanId = { 'sess-1': 'plan-1' };
    render(<PlanStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(state.deletePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Implement auth module' }));
    expect(state.deletePlan).toHaveBeenCalledWith('sess-1', 'plan-1');
  });

  it('starts the plan without opening the agent, and opens it only from the toast action', async () => {
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
    state.focusedPlanId = { 'sess-1': 'plan-1' };
    render(<PlanStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(state.runPlan).toHaveBeenCalledWith('sess-1', 'plan-1'));
    await waitFor(() => expect(showToast).toHaveBeenCalledOnce());
    expect(state.selectAgent).not.toHaveBeenCalled();
    const opts = showToast.mock.calls[0]![2];
    expect(opts?.title).toBe('Implementer started');
    expect(opts?.action?.label).toBe('Open the agent');

    opts?.action?.onClick();

    await waitFor(() => expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-impl'));
    expect(state.setActiveLens).toHaveBeenCalledWith('sess-1', 'agents');
  });

  it('renders a consumed plan beneath the active empty state without interaction', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Implement auth module',
        bodyMd: '## Steps',
        status: 'consumed',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 1,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} />);

    expect(screen.getByText('Nothing active')).toBeDefined();
    const emptyCard = screen.getByText('Nothing active').closest('.border-dashed');
    expect(emptyCard).not.toBeNull();
    expect(screen.getByText('Implement auth module')).toBeDefined();
    expect(screen.getByText('consumed')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Finished history' })).toBeDefined();
  });

  it('shows consumed plans alongside active plans too', () => {
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
      {
        id: 'plan-2',
        agentId: 'agent-2',
        sessionId: 'sess-1',
        title: 'Old plan',
        bodyMd: '## Steps',
        status: 'consumed',
        createdAt: '2026-01-02T00:00:00.000Z',
        runCount: 1,
      },
    ];
    render(<PlanStudio sessionId={'sess-1' as never} />);

    expect(screen.queryByText('Nothing active')).toBeNull();
    expect(screen.getByText('Old plan')).toBeDefined();
  });

  it('selects a plan from the list, focusing it', () => {
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
    render(<PlanStudio sessionId={'sess-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: /Implement auth module/i }));

    expect(state.setFocusedPlanId).toHaveBeenCalledWith('sess-1', 'plan-1');
  });
});

describe('PlanStudio subpage', () => {
  it('fills the pane (not a fixed overlay) when a plan is focused', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'First plan',
        bodyMd: 'body one',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    state.focusedPlanId = { 'sess-1': 'plan-1' };
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('h-full');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-50');
    expect(container.querySelector('.max-w-5xl')).not.toBeNull();
  });

  it('shows the plan matching focusedPlanId from the store', () => {
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
    state.focusedPlanId = { 'sess-1': 'plan-2' };
    const { container } = render(<PlanStudio sessionId={'sess-1' as never} />);
    const title = screen.getByRole('heading', { level: 2, name: 'Second plan' });
    const status = screen.getByText('active');

    expect(screen.getByText('body two')).toBeDefined();
    expect(container.querySelector('.max-w-5xl')).not.toBeNull();
    expect(title.className).toContain('text-xl');
    expect(title.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.closest('.px-6')?.className).toContain('py-5');
  });

  it('re-renders as the list when focusedPlanId transitions to null while mounted', () => {
    state.plans = [
      {
        id: 'plan-1',
        agentId: 'agent-1',
        sessionId: 'sess-1',
        title: 'Alpha plan',
        bodyMd: 'alpha body',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        runCount: 0,
      },
    ];
    state.focusedPlanId = { 'sess-1': 'plan-1' };
    const { rerender } = render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('alpha body')).toBeDefined();

    state.focusedPlanId = { 'sess-1': null };
    rerender(<PlanStudio sessionId={'sess-1' as never} />);

    expect(screen.queryByText('alpha body')).toBeNull();
    expect(screen.getByText('Alpha plan')).toBeDefined();
  });

  it('switches to a different plan when focusedPlanId changes while mounted', () => {
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
    state.focusedPlanId = { 'sess-1': 'plan-a' };
    const { rerender } = render(<PlanStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('alpha body')).toBeDefined();

    state.focusedPlanId = { 'sess-1': 'plan-b' };
    rerender(<PlanStudio sessionId={'sess-1' as never} />);

    expect(screen.queryByText('alpha body')).toBeNull();
    expect(screen.getByText('beta body')).toBeDefined();
  });
});
