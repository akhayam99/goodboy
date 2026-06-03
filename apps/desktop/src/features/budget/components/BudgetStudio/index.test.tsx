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
    loadBudgetRules: vi.fn(),
    loadBudgetAlerts: vi.fn(),
    loadSessionTelemetry: vi.fn(),
    dismissBudgetAlert: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessions: () => state.sessions,
}));

import { BudgetStudio } from './index';

beforeEach(() => {
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
        recordedAt: '2026-06-01T00:00:00.000Z',
      },
    ],
  };
});
afterEach(cleanup);

describe('BudgetStudio', () => {
  it('renders the overview scope by default', () => {
    render(<BudgetStudio workspaceName="goodboy" onClose={vi.fn()} />);
    expect(screen.getByText('Budget Studio')).toBeDefined();
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
  });
});
