// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { resolveProvider } from '@goodboy/core';
import type { BudgetRule, ProviderBudgetStatus, WorkspaceId } from '@goodboy/types';
import {
  providerBudgetStatusFor,
  WORKSPACE_WINDOW_SPEND_USD,
} from './testing/providerBudgetFixture';

const { state, rust } = vi.hoisted(() => ({
  rust: { status: null as ProviderBudgetStatus | null, idle: null as ProviderBudgetStatus | null },
  state: {
    currentSessionId: 'session-1',
    sessions: [{ id: 'session-1', goal: 'build the feature' }] as ReadonlyArray<{
      id: string;
      goal: string;
    }>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
    providerSpendBreakdown: [] as ReadonlyArray<{ provider: string; spentUsd: number }>,
    providerBudgetStatus: {} as Record<string, unknown>,
    budgetAlerts: [] as ReadonlyArray<unknown>,
    budgetRules: [] as ReadonlyArray<BudgetRule>,
    sessionBudgets: {} as Record<string, unknown>,
    clearSessionBudget: vi.fn(),
    currentWorkspaceId: 'workspace-1',
    navigate: vi.fn(),
    loadBudgetRules: vi.fn(async () => undefined),
    loadBudgetAlerts: vi.fn(async () => undefined),
    loadSessionTelemetry: vi.fn(async () => undefined),
    loadSessionBudget: vi.fn(async () => undefined),
    dismissBudgetAlert: vi.fn(),
    saveBudgetRule: vi.fn(),
    deleteBudgetRule: vi.fn(),
    setSessionBudget: vi.fn(),
    refreshProviderSpendBreakdown: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string, args?: { provider?: string }) => {
    if (command === 'provider_budget_overview') {
      return {
        status: rust.status,
        periods: { todayUsd: 0, last7DaysUsd: 0, thisMonthUsd: rust.status?.spentUsd ?? 0 },
      };
    }
    if (command === 'check_provider_budget') {
      return args?.provider === 'anthropic' ? rust.status : rust.idle;
    }
    throw new Error(`unexpected command ${command}`);
  }),
}));

vi.mock('../impact/hooks/useImpactMetrics', () => ({
  useImpactMetrics: () => {
    const empty = { data: null, error: null };
    return {
      overview: empty,
      pullRequests: empty,
      reviews: empty,
      externalTasks: empty,
      agentDurations: empty,
      flowHealth: empty,
      cacheEfficiency: empty,
      contextGrowth: empty,
      turns: empty,
      nudges: empty,
      loading: { overview: false, shipped: false, flow: false, efficiency: false },
      retry: vi.fn(),
    };
  },
}));

vi.mock('../../store', async () => ({
  ...(await import('../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessions: () => state.sessions,
  useTelemetryForSessions: () => state.sessionTelemetry,
}));

import { ProviderUsagePill } from '../chat/components/ProviderUsagePill';
import { ImpactStudio } from '../impact/components/ImpactStudio';
import { invokeCheckProviderBudget } from './budget';
import { SpendInGoodboy } from '../providers/components/ProviderStudio/ProviderPage/UsageGroup/SpendInGoodboy';
import { loadProviderBudgetStatuses } from '../../store/slices/budget';

const RULE: BudgetRule = {
  id: 'rule-1',
  provider: 'anthropic',
  period: 'monthly',
  capUsd: 200,
  alertThresholdPct: 80,
  extraTokensBudget: null,
  createdAt: '2026-09-01T00:00:00.000Z' as BudgetRule['createdAt'],
};

const SCENARIOS = [
  { spentUsd: 24, pctUsed: 12, movesTurns: false },
  { spentUsd: 170, pctUsed: 85, movesTurns: true },
] as const;

beforeEach(() => {
  state.sessionTelemetry = {
    'session-1': [
      {
        id: 't1',
        runId: 'r1',
        sessionId: 'session-1',
        kind: 'turn',
        provider: 'anthropic',
        model: 'claude-opus-5',
        inputTokens: 50,
        outputTokens: 100,
        estimatedCostUsd: WORKSPACE_WINDOW_SPEND_USD,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
  state.providerSpendBreakdown = [{ provider: 'anthropic', spentUsd: WORKSPACE_WINDOW_SPEND_USD }];
  state.budgetRules = [RULE];
});

afterEach(() => {
  cleanup();
  rust.status = null;
  state.providerBudgetStatus = {};
});

describe.each(SCENARIOS)('$pctUsed% of the cap spent', ({ spentUsd, pctUsed, movesTurns }) => {
  beforeEach(async () => {
    rust.status = providerBudgetStatusFor({ spentUsd, capUsd: 200 });
    rust.idle = providerBudgetStatusFor({ spentUsd: 0, capUsd: 200 });
    state.providerBudgetStatus = await loadProviderBudgetStatuses({ rules: [RULE] });
  });

  it('shows the same percentage on the provider page', async () => {
    render(<SpendInGoodboy providerId="anthropic" />);

    await waitFor(() => expect(screen.getByText(new RegExp(`${pctUsed}% used`))).toBeDefined());
  });

  it('shows the same percentage in Impact, whatever the workspace spent in the window', () => {
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as WorkspaceId}
        initialScope={{ kind: 'provider', provider: 'anthropic' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(`${pctUsed}%`)).toBeDefined();
    expect(screen.queryByText(/^95%$/)).toBeNull();
  });

  it('moves turns off the provider exactly when that percentage crosses the threshold', async () => {
    const decision = await resolveProvider({
      sessionPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      turnOverride: undefined,
      connectedProviders: ['anthropic', 'codex'],
      budgetChecker: {
        checkProviderBudget: (provider, period) => invokeCheckProviderBudget(provider, period),
      },
      cooldownChecker: { isProviderCoolingDown: () => false },
      getDefaultModel: () => 'model',
    });

    expect(decision.fallbackUsed).toBe(movesTurns);
  });
});

describe('the chat usage pill', () => {
  it('counts what is left of the same percentage', async () => {
    rust.status = providerBudgetStatusFor({ spentUsd: 170, capUsd: 200 });
    state.providerBudgetStatus = await loadProviderBudgetStatuses({ rules: [RULE] });

    render(<ProviderUsagePill provider="anthropic" />);

    expect(screen.getByText(/15% left/)).toBeDefined();
  });
});
