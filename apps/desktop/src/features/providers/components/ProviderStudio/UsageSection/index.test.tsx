// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BudgetRule, IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';

const { state, spendSpy } = vi.hoisted(() => ({
  state: {
    providerLimits: {} as Partial<Record<ProviderId, ProviderLimits>>,
    budgetRules: [] as ReadonlyArray<BudgetRule>,
    loadBudgetRules: vi.fn(async () => undefined),
    currentWorkspaceId: 'ws-harborline',
    workspaces: [] as ReadonlyArray<never>,
    providers: [] as ReadonlyArray<{ id: ProviderId; connection: string }>,
  },
  spendSpy: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return { ...actual, summarizeProviderSpendPeriods: spendSpy };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { UsageSection } from './index';

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
  spendSpy.mockReset();
  spendSpy.mockResolvedValue({ todayUsd: 3.2, last7DaysUsd: 18.4, thisMonthUsd: 61.02 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UsageSection', () => {
  it('lists each window with its use and reset, and warns once near the limit', async () => {
    state.providerLimits = { anthropic: CLAUDE_LOW };
    render(<UsageSection providerId="anthropic" billing="plan" />);

    const rows = within(screen.getByRole('list', { name: 'Claude usage windows' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      '5-hour window82% usedResets 14:30 · in 2h 30m',
      expect.stringMatching(/^Weekly47% usedResets \S+ 09:00 · in 3 days$/),
    ]);
    expect(screen.getByText('Claude is about to run out.')).toBeTruthy();
    expect(screen.getByText('The 5-hour window resets at 14:30.')).toBeTruthy();
    expect(screen.getByText('Reported by Claude · Updated 3m ago')).toBeTruthy();
    expect(screen.getByText(/Goodboy never reads your Claude sign-in/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('$18.40')).toBeTruthy());
    expect(spendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', workspaceId: 'ws-harborline' }),
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
    render(<UsageSection providerId="codex" billing="plan" />);

    expect(screen.getByText('Codex is out for the week.')).toBeTruthy();
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
    render(<UsageSection providerId="codex" billing="plan" />);

    expect(screen.getByText(/Auto routes new agents to Claude until then\.$/)).toBeTruthy();
    state.providers = [];
  });

  it('tells a provider without limits apart from one still waiting for a turn', () => {
    render(<UsageSection providerId="cursor" billing="plan" />);
    expect(screen.getByText("Cursor doesn't report its limits to Goodboy.")).toBeTruthy();
    expect(screen.queryByText(/plan covers this/)).toBeNull();
    cleanup();

    render(<UsageSection providerId="anthropic" billing="plan" />);
    expect(screen.getByText('Claude shares its limits during a turn.')).toBeTruthy();
    expect(screen.getByText(/Claude plan covers this/)).toBeTruthy();
  });

  it('bills an api key provider per token, with spend only', () => {
    render(<UsageSection providerId="openrouter" billing="token" />);

    expect(screen.getByText('Billed per token. No usage windows.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('region', { name: 'Spend in Goodboy' })).toBeTruthy();
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
    render(<UsageSection providerId="anthropic" billing="plan" />);

    await waitFor(() => expect(screen.getByText('$80.00 a month, $61.02 used')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Edit in Impact' }));
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      scope: { kind: 'provider', provider: 'anthropic' },
    });
    window.removeEventListener('goodboy:open-impact-studio', listener);
  });
});
