// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { ProviderBudgetStatus } from '@goodboy/types';
import { providerBudgetStatusFor } from '../../../budget/testing/providerBudgetFixture';

const { state } = vi.hoisted(() => ({
  state: {
    providerBudgetStatus: {} as Record<string, ProviderBudgetStatus>,
    refreshProviderBudgetStatus: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ProviderUsagePill } from './index';

beforeEach(() => {
  state.providerBudgetStatus = {};
  state.refreshProviderBudgetStatus.mockClear();
});
afterEach(cleanup);

describe('ProviderUsagePill', () => {
  it('renders nothing when there is no entry for the provider', () => {
    const { container } = render(<ProviderUsagePill provider="anthropic" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the provider has no cap', () => {
    state.providerBudgetStatus = {
      anthropic: { ...providerBudgetStatusFor({ spentUsd: 1, capUsd: 100 }), capUsd: null },
    };
    const { container } = render(<ProviderUsagePill provider="anthropic" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides a healthy budget', () => {
    state.providerBudgetStatus = {
      anthropic: providerBudgetStatusFor({ spentUsd: 25, capUsd: 100 }),
    };
    render(<ProviderUsagePill provider="anthropic" />);
    expect(screen.queryByText(/75% left/i)).toBeNull();
  });

  it('says how much is left once past half the cap', () => {
    state.providerBudgetStatus = {
      anthropic: providerBudgetStatusFor({ spentUsd: 70, capUsd: 100 }),
    };
    render(<ProviderUsagePill provider="anthropic" />);
    expect(screen.getByText(/30% left/)).toBeDefined();
  });

  it('reloads and hides a status from a month that has ended', () => {
    state.providerBudgetStatus = {
      anthropic: {
        ...providerBudgetStatusFor({ spentUsd: 70, capUsd: 100 }),
        windowEndMs: Date.now() - 1,
      },
    };
    const { container } = render(<ProviderUsagePill provider="anthropic" />);

    expect(container.firstChild).toBeNull();
    expect(state.refreshProviderBudgetStatus).toHaveBeenCalledOnce();
  });
});
