// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

type Breakdown = {
  readonly provider: string;
  readonly spentUsd: number;
  readonly capUsd: number | null;
  readonly pct: number;
};

const { state } = vi.hoisted(() => ({
  state: { providerSpendBreakdown: [] as ReadonlyArray<Breakdown> },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { providerSpendBreakdown: ReadonlyArray<Breakdown> }) => T) =>
    selector(state),
}));

import { ProviderUsagePill } from './index';

beforeEach(() => {
  state.providerSpendBreakdown = [];
});
afterEach(cleanup);

describe('ProviderUsagePill', () => {
  it('renders nothing when there is no entry for the provider', () => {
    const { container } = render(<ProviderUsagePill provider="anthropic" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when capUsd is null', () => {
    state.providerSpendBreakdown = [{ provider: 'anthropic', spentUsd: 1, capUsd: null, pct: 0 }];
    const { container } = render(<ProviderUsagePill provider="anthropic" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a pct-left label when the cap is set', () => {
    state.providerSpendBreakdown = [
      { provider: 'anthropic', spentUsd: 25, capUsd: 100, pct: 0.25 },
    ];
    render(<ProviderUsagePill provider="anthropic" />);
    expect(screen.getByText(/75% left/i)).toBeDefined();
  });
});
