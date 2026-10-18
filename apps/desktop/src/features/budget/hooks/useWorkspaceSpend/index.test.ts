import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { BudgetRule, IsoDateTime } from '@goodboy/types';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

const CREATED_AT = typedString<IsoDateTime>({ value: '2026-09-11T10:00:00.000Z' });

const h = vi.hoisted(() => ({
  store: {
    currentSessionId: null,
    currentWorkspaceId: null,
    sessionTelemetry: {},
    providerSpendBreakdown: [],
    budgetAlerts: [],
    budgetRules: [] as ReadonlyArray<BudgetRule>,
    sessionBudgets: {},
    dismissBudgetAlert: vi.fn(async () => undefined),
    saveBudgetRule: vi.fn(async () => undefined),
    deleteBudgetRule: vi.fn(async () => undefined),
    setSessionBudget: vi.fn(async () => undefined),
    refreshProviderSpendBreakdown: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useSessions: () => [],
  useTelemetryForSessions: () => h.store.sessionTelemetry,
  useDormantSpend: () => [],
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

vi.mock('../useBudgetData', () => ({
  useBudgetData: () => ({}),
}));

import { useWorkspaceSpend } from './index';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.store.budgetRules = [];
});

describe('useWorkspaceSpend', () => {
  it('updates a provider limit without deleting or replacing its rule', async () => {
    const existing: BudgetRule = {
      id: 'rule-1',
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 50,
      alertThresholdPct: 0.8,
      extraTokensBudget: null,
      createdAt: CREATED_AT,
    };
    h.store.budgetRules = [existing];
    const { result } = renderHook(() => useWorkspaceSpend({ sinceMs: null }));

    await act(async () => {
      await result.current.saveProviderCap({ provider: 'anthropic', capUsd: 75 });
    });

    expect(h.store.saveBudgetRule).toHaveBeenCalledWith({ ...existing, capUsd: 75 });
    expect(h.store.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it('writes the limit and the warn share in one rule update', async () => {
    const existing: BudgetRule = {
      id: 'rule-1',
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 50,
      alertThresholdPct: 80,
      extraTokensBudget: null,
      createdAt: CREATED_AT,
    };
    h.store.budgetRules = [existing];
    const { result } = renderHook(() => useWorkspaceSpend({ sinceMs: null }));

    await act(async () => {
      await result.current.saveProviderCap({
        provider: 'anthropic',
        capUsd: 60,
        thresholdPct: 90,
      });
    });

    expect(h.store.saveBudgetRule).toHaveBeenCalledTimes(1);
    expect(h.store.saveBudgetRule).toHaveBeenCalledWith({
      ...existing,
      capUsd: 60,
      alertThresholdPct: 90,
    });
    expect(h.store.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it('starts a new limit at 80 percent when no share is given', async () => {
    const { result } = renderHook(() => useWorkspaceSpend({ sinceMs: null }));

    await act(async () => {
      await result.current.saveProviderCap({ provider: 'anthropic', capUsd: 40 });
    });

    expect(h.store.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 40,
      alertThresholdPct: 80,
      extraTokensBudget: null,
    });
  });
});
