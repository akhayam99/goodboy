// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    currentSessionId: 'session-1',
    sessions: [{ id: 'session-1', goal: 'build the feature' }] as ReadonlyArray<{
      id: string;
      goal: string;
    }>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
    workspaceSummary: { inputTokens: 100, outputTokens: 200, estimatedCostUsd: 5, recordCount: 4 },
    providerSpendBreakdown: [
      { provider: 'anthropic', spentUsd: 3, capUsd: 10, pct: 0.3 },
    ] as ReadonlyArray<{
      provider: string;
      spentUsd: number;
      capUsd: number | null;
      pct: number;
    }>,
    budgetAlerts: [] as ReadonlyArray<unknown>,
    budgetRules: [] as ReadonlyArray<unknown>,
    sessionBudgets: {} as Record<string, { softCapUsd: number }>,
    currentWorkspaceId: 'workspace-1',
    setCurrentSession: vi.fn(),
    loadBudgetRules: vi.fn(),
    loadBudgetAlerts: vi.fn(),
    loadSessionTelemetry: vi.fn(),
    loadSessionBudget: vi.fn(),
    dismissBudgetAlert: vi.fn(),
    saveBudgetRule: vi.fn(),
    deleteBudgetRule: vi.fn(),
    setSessionBudget: vi.fn(),
    refreshProviderSpendBreakdown: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessions: () => state.sessions,
}));

import { BudgetStudio } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  state.loadBudgetRules.mockResolvedValue(undefined);
  state.loadBudgetAlerts.mockResolvedValue(undefined);
  state.loadSessionTelemetry.mockResolvedValue(undefined);
  state.loadSessionBudget.mockResolvedValue(undefined);
  state.sessionTelemetry = {
    'session-1': [
      {
        id: 't1',
        runId: 'r1',
        sessionId: 'session-1',
        kind: 'turn',
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        inputTokens: 50,
        outputTokens: 100,
        estimatedCostUsd: 1.5,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
});
afterEach(cleanup);

describe('BudgetStudio', () => {
  it('renders the overview scope by default', () => {
    render(<BudgetStudio workspaceName="goodboy" onClose={vi.fn()} />);
    expect(screen.getByText('Budget studio')).toBeDefined();
    expect(screen.getByText(/spend by provider/i)).toBeDefined();
  });

  it('switches to a provider scope and shows its spend breakdown', () => {
    render(<BudgetStudio workspaceName="goodboy" onClose={vi.fn()} />);
    const [claudeButton] = screen.getAllByRole('button', { name: /claude/i });
    fireEvent.click(claudeButton!);
    expect(screen.getByText(/total spend/i)).toBeDefined();
  });

  it('renders a session scope with all sessions listed', () => {
    render(
      <BudgetStudio
        workspaceName="goodboy"
        initialScope={{ kind: 'session', sessionId: 'session-1' as SessionId }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/build the feature/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/session cost/i)).toBeDefined();
    expect(screen.getByText(/cost per turn/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'recent' })).toBeDefined();
  });

  it('authors a new provider cap via saveBudgetRule', () => {
    state.budgetRules = [];
    render(
      <BudgetStudio
        workspaceName="goodboy"
        initialScope={{ kind: 'provider', provider: 'anthropic' }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/monthly cap/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /set cap/i }));
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 50,
      alertThresholdPct: 80,
      extraTokensBudget: null,
    });
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it('edits an existing provider cap as delete then save', async () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 10,
        alertThresholdPct: 90,
        extraTokensBudget: 5,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    render(
      <BudgetStudio
        workspaceName="goodboy"
        initialScope={{ kind: 'provider', provider: 'anthropic' }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/monthly cap/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /update cap/i }));
    await Promise.resolve();
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 25,
      alertThresholdPct: 90,
      extraTokensBudget: 5,
    });
  });

  it('removes a provider cap via deleteBudgetRule', () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 10,
        alertThresholdPct: 80,
        extraTokensBudget: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    render(
      <BudgetStudio
        workspaceName="goodboy"
        initialScope={{ kind: 'provider', provider: 'anthropic' }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
  });

  it('sets a session soft cap via setSessionBudget', () => {
    state.sessionBudgets = {};
    render(
      <BudgetStudio
        workspaceName="goodboy"
        initialScope={{ kind: 'session', sessionId: 'session-1' as SessionId }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/session soft cap/i), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: /set cap/i }));
    expect(state.setSessionBudget).toHaveBeenCalledWith('session-1', 12.5);
  });

  it('renders a failed panel load and retries it', async () => {
    state.loadBudgetAlerts.mockRejectedValueOnce(new Error('alerts unavailable'));
    render(<BudgetStudio workspaceName="goodboy" onClose={vi.fn()} />);

    expect((await screen.findByRole('alert')).textContent).toContain('alerts unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.loadBudgetAlerts).toHaveBeenCalledTimes(2);
  });

  it('opens the session from a turn row', () => {
    const onClose = vi.fn();
    render(<BudgetStudio workspaceName="goodboy" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open session build the feature' }));
    expect(state.setCurrentSession).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('filters telemetry with the header window control', () => {
    state.sessionTelemetry = {
      'session-1': [
        ...state.sessionTelemetry['session-1']!,
        {
          id: 't-old',
          runId: 'r-old',
          sessionId: 'session-1',
          kind: 'turn',
          provider: 'anthropic',
          model: 'legacy-budget-model',
          inputTokens: 20,
          outputTokens: 30,
          estimatedCostUsd: 2,
          recordedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
    };

    render(<BudgetStudio workspaceName="goodboy" onClose={vi.fn()} />);

    expect(screen.queryByText('Legacy Budget Model')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(screen.getAllByText('Legacy Budget Model').length).toBeGreaterThan(0);
  });
});
