// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BudgetRule, IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';

const { state, invokeSpy } = vi.hoisted(() => ({
  state: {
    providerLimits: {} as Partial<Record<ProviderId, ProviderLimits>>,
    budgetRules: [] as ReadonlyArray<BudgetRule>,
    loadBudgetRules: vi.fn(async () => undefined),
    currentWorkspaceId: 'ws-harborline',
    workspaces: [] as ReadonlyArray<never>,
    providers: [] as ReadonlyArray<{ id: ProviderId; connection: string }>,
    providerLimitsProbe: {} as Record<string, unknown>,
    refreshClaudeUsage: vi.fn(async () => undefined),
    refreshCodexLimits: vi.fn(async () => undefined),
  },
  invokeSpy: vi.fn(),
}));

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { providerBudgetStatusFor } from '../../../../../budget/testing/providerBudgetFixture';
import { UsageGroup } from './index';

const NOW = new Date(2026, 8, 25, 12, 0).getTime();

const localIso = (hours: number, minutes: number, dayOffset = 0): IsoDateTime =>
  new Date(2026, 8, 25 + dayOffset, hours, minutes).toISOString() as IsoDateTime;

const CLAUDE_LOW: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: 0.47,
      resetsAt: localIso(9, 0, 3),
    },
    {
      kind: 'fiveHour',
      model: null,
      status: 'warning',
      usedFraction: 0.82,
      resetsAt: localIso(14, 30),
    },
  ],
  observedAt: localIso(11, 57),
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  state.providerLimits = {};
  state.budgetRules = [];
  invokeSpy.mockReset();
  invokeSpy.mockResolvedValue({
    status: providerBudgetStatusFor({ spentUsd: 61.02, capUsd: 80 }),
    periods: { todayUsd: 3.2, last7DaysUsd: 18.4, thisMonthUsd: 61.02 },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UsageGroup', () => {
  it('lists each window with its use and reset, and warns once near the limit', async () => {
    state.providerLimits = { anthropic: CLAUDE_LOW };
    render(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);

    const rows = within(screen.getByRole('list', { name: 'Claude usage windows' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      '5-hour window82% usedResets 14:30 · in 2h 30m',
      expect.stringMatching(/^Weekly47% usedResets \S+ 09:00 · in 3 days$/),
    ]);
    screen.getByText('Claude is about to run out.');
    screen.getByText('The 5-hour window resets at 14:30.');
    screen.getByText('Updated 3m ago');
    screen.getByText(/never reads your sign-in/);
    await waitFor(() => screen.getByText('$18.40'));
    expect(invokeSpy).toHaveBeenCalledWith(
      'provider_budget_overview',
      expect.objectContaining({ provider: 'anthropic' }),
    );
  });

  it('says Codex is out for the week with the day it comes back', () => {
    state.providerLimits = {
      codex: {
        providerId: 'codex',
        plan: 'Plus',
        status: 'reached',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'reached',
            usedFraction: 1,
            resetsAt: localIso(18, 12, 6),
          },
        ],
        observedAt: localIso(11, 48),
      },
    };
    render(<UsageGroup providerId="codex" billing="plan" planLabel={null} />);

    screen.getByText('Codex is out for the week.');
    expect(screen.getByRole('listitem').textContent).toMatch(/100% usedOut until \S+ 18:12$/);
    expect(screen.queryByText(/Auto routes new agents/)).toBeNull();
  });

  it('says where Auto sends new agents only when the ladder really skips the provider', () => {
    state.providers = [
      { id: 'codex', connection: 'connected' },
      { id: 'anthropic', connection: 'connected' },
    ];
    state.providerLimits = {
      codex: {
        providerId: 'codex',
        plan: 'Plus',
        status: 'reached',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'reached',
            usedFraction: 1,
            resetsAt: localIso(18, 12, 6),
          },
        ],
        observedAt: localIso(11, 48),
      },
    };
    render(<UsageGroup providerId="codex" billing="plan" planLabel={null} />);

    screen.getByText(/Auto routes new agents to Claude until then\.$/);
    state.providers = [];
  });

  it('tells a provider without limits apart from one still waiting for a turn', () => {
    render(<UsageGroup providerId="cursor" billing="plan" planLabel={null} />);
    screen.getByText("Cursor doesn't share usage with other apps.");
    expect(screen.queryByText(/plan covers this/)).toBeNull();
    cleanup();

    render(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);
    screen.getByText('No Claude usage yet.');
    screen.getByText(/Claude plan covers this/);
  });

  it('bills an api key provider per token, with spend only', () => {
    render(<UsageGroup providerId="openrouter" billing="token" planLabel={null} />);

    screen.getByText('Billed per token by your key. No usage windows.');
    expect(screen.queryByRole('list')).toBeNull();
    screen.getByRole('region', { name: 'Spend in Goodboy' });
  });

  it('shows the budget next to the spend and opens Impact on the provider', async () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 80,
        alertThresholdPct: 80,
        extraTokensBudget: null,
        createdAt: localIso(9, 0, -20),
      },
    ];
    const listener = vi.fn();
    window.addEventListener('goodboy:open-impact-studio', listener);
    render(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);

    await waitFor(() =>
      screen.getByText(/^Budget \$80\.00 a month, 76% used across all workspaces, resets /),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open in Impact' }));
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      scope: { kind: 'provider', provider: 'anthropic' },
    });
    window.removeEventListener('goodboy:open-impact-studio', listener);
  });
  it('keeps the numbers and does not refetch when the same rule is reloaded', async () => {
    const rule: BudgetRule = {
      id: 'rule-1',
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 80,
      alertThresholdPct: 80,
      extraTokensBudget: null,
      createdAt: localIso(9, 0, -20),
    };
    state.budgetRules = [rule];
    const { rerender } = render(
      <UsageGroup providerId="anthropic" billing="plan" planLabel={null} />,
    );
    await waitFor(() => screen.getByText('$18.40'));

    state.budgetRules = [{ ...rule }];
    rerender(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);

    screen.getByText('$18.40');
    expect(invokeSpy).toHaveBeenCalledTimes(1);
  });

  it('asks codex again with the reset details from the refresh button', () => {
    render(<UsageGroup providerId="codex" billing="plan" planLabel="Plus" />);

    fireEvent.click(screen.getByRole('button', { name: 'Check Codex usage now' }));

    expect(state.refreshCodexLimits).toHaveBeenCalledWith({ withResetDetails: true });
    screen.getByText(/Your Plus plan covers this/);
  });

  it('says when three checks in a row failed and offers another try', () => {
    state.providerLimitsProbe = {
      anthropic: { isChecking: false, checkedAt: null, failures: 3 },
    };
    render(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);

    screen.getByText("Couldn't check Claude usage.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refreshClaudeUsage).toHaveBeenCalled();
    state.providerLimitsProbe = {};
  });
  it('links to claude.ai for a free reset when a Claude window is full', () => {
    state.providerLimits = {
      anthropic: {
        ...CLAUDE_LOW,
        status: 'reached',
        windows: [
          {
            kind: 'fiveHour',
            model: null,
            status: 'reached',
            usedFraction: 1,
            resetsAt: localIso(14, 30),
          },
        ],
      },
    };
    render(<UsageGroup providerId="anthropic" billing="plan" planLabel={null} />);

    screen.getByText(/can only be used on claude.ai or in Claude Desktop/);
    screen.getByRole('button', { name: 'Open Claude usage' });
  });
});
