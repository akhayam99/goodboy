// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BudgetAlert, IsoDateTime } from '@goodboy/types';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { SpendSection } from './SpendSection';

const OK: QueryResult<void> = { data: null, error: null };

const baseProps = {
  providers: [],
  alerts: [] as ReadonlyArray<BudgetAlert>,
  rulesResult: OK,
  alertsResult: OK,
  telemetryResult: OK,
  isLoading: false,
  onDismissAlert: vi.fn(),
  onSelectProvider: vi.fn(),
  onRetryRules: vi.fn(),
  onRetryAlerts: vi.fn(),
  onRetryTelemetry: vi.fn(),
};

type AlertParams = {
  readonly dismissedAt?: IsoDateTime;
};

const alert = ({ dismissedAt }: AlertParams): BudgetAlert => ({
  id: 'alert-1',
  kind: 'provider-threshold',
  provider: 'anthropic',
  capUsd: 10,
  currentUsd: 9,
  createdAt: '2026-06-01T00:00:00.000Z' as IsoDateTime,
  dismissedAt,
});

afterEach(cleanup);

describe('SpendSection', () => {
  it('collapses to its header when the window holds no spend', () => {
    render(<SpendSection {...baseProps} />);

    expect(screen.getByText('Spend')).toBeDefined();
    expect(screen.queryByText('by provider')).toBeNull();
    expect(screen.queryByText('alerts')).toBeNull();
  });

  it('names the cap and the share of it each provider has used', () => {
    render(
      <SpendSection
        {...baseProps}
        providers={[
          { provider: 'anthropic', spentUsd: 3, capUsd: 10, pct: 0.3 },
          { provider: 'codex', spentUsd: 1, capUsd: null, pct: 0 },
        ]}
      />,
    );

    expect(screen.getByText('$10.00 cap · 30% used')).toBeDefined();
    expect(screen.getByText('no cap')).toBeDefined();
  });

  it('hands a provider row back as the scope to open', () => {
    const onSelectProvider = vi.fn();
    render(
      <SpendSection
        {...baseProps}
        onSelectProvider={onSelectProvider}
        providers={[{ provider: 'anthropic', spentUsd: 3, capUsd: 10, pct: 0.3 }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /claude/i }));
    expect(onSelectProvider).toHaveBeenCalledWith('anthropic');
  });

  it('shows a live alert and stays silent once every alert is dismissed', () => {
    const { rerender } = render(<SpendSection {...baseProps} alerts={[alert({})]} />);
    expect(screen.getByText(/nearing its cap/i)).toBeDefined();

    rerender(
      <SpendSection
        {...baseProps}
        alerts={[alert({ dismissedAt: '2026-06-02T00:00:00.000Z' as IsoDateTime })]}
      />,
    );
    expect(screen.queryByText(/nearing its cap/i)).toBeNull();
  });

  it('surfaces a failed load with a retry', () => {
    const onRetryRules = vi.fn();
    render(
      <SpendSection
        {...baseProps}
        rulesResult={{ data: null, error: new Error('rules unavailable') }}
        onRetryRules={onRetryRules}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('rules unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryRules).toHaveBeenCalledOnce();
  });
});
