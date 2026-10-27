// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { providerBudgetStatusFor } from '../../testing/providerBudgetFixture';
import { ProviderPanel } from './ProviderPanel';

const OK: QueryResult<void> = { data: null, error: null };

const FRAME = { title: 'Impact', meta: null, actions: null, tabs: null };

type RenderParams = {
  readonly spentUsd: number;
  readonly capUsd: number;
};

const renderPanel = ({ spentUsd, capUsd }: RenderParams) =>
  render(
    <ProviderPanel
      frame={FRAME}
      rangeLabel="30 days"
      provider="anthropic"
      entry={{
        provider: 'anthropic',
        spentUsd,
        budget: providerBudgetStatusFor({ spentUsd, capUsd }),
      }}
      turns={[]}
      rule={null}
      rulesResult={OK}
      telemetryResult={OK}
      isLoading={false}
      onSaveLimit={vi.fn()}
      onRemoveLimit={vi.fn()}
      onRetryRules={vi.fn()}
      onRetryTelemetry={vi.fn()}
      onOpenSession={vi.fn()}
    />,
  );

afterEach(cleanup);

describe('ProviderPanel limit figures', () => {
  it('shows Left as the limit minus the spent amount on screen', () => {
    renderPanel({ spentUsd: 152.37, capUsd: 170 });

    expect(screen.getAllByText('$152.37')).toHaveLength(1);
    expect(screen.getAllByText('$170.00')).toHaveLength(1);
    expect(screen.getAllByText('$17.63')).toHaveLength(1);
  });

  it('shows zero Left once the spent amount passes the limit', () => {
    renderPanel({ spentUsd: 180.5, capUsd: 170 });

    expect(screen.getAllByText('$180.50')).toHaveLength(1);
    expect(screen.getAllByText('$0')).toHaveLength(1);
  });
});
