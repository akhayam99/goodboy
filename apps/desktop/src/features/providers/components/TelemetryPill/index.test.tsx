// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

interface Spend {
  readonly provider: string;
  readonly spentUsd: number;
  readonly capUsd: number | null;
}

const { state } = vi.hoisted(() => ({
  state: {
    sessionSummary: null as { estimatedCostUsd: number } | null,
    workspaceSummary: null as { estimatedCostUsd: number } | null,
    providerSpendBreakdown: [] as ReadonlyArray<Spend>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../PricingDialog', () => ({
  PricingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pricing-dialog-mock" /> : null,
}));

import { TelemetryPill } from './index';

beforeEach(() => {
  state.sessionSummary = { estimatedCostUsd: 1.25 };
  state.workspaceSummary = { estimatedCostUsd: 10 };
  state.providerSpendBreakdown = [];
});
afterEach(cleanup);

describe('TelemetryPill', () => {
  it('renders the session + workspace cost in the pill', () => {
    render(<TelemetryPill />);
    expect(screen.getByText(/session/i)).toBeDefined();
    expect(screen.getByLabelText(/open pricing breakdown/i)).toBeDefined();
  });

  it('opens the pricing dialog when clicked', () => {
    render(<TelemetryPill />);
    fireEvent.click(screen.getByLabelText(/open pricing breakdown/i));
    expect(screen.getByTestId('pricing-dialog-mock')).toBeDefined();
  });
});
