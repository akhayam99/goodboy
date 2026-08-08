// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { OverviewPanel } from './OverviewPanel';

const OK: QueryResult<void> = { data: null, error: null };

const baseProps = {
  providers: [],
  turns: [],
  alerts: [],
  rulesResult: OK,
  alertsResult: OK,
  telemetryResult: OK,
  isLoading: false,
  onDismissAlert: vi.fn(),
  onSelect: vi.fn(),
  onRetryRules: vi.fn(),
  onRetryAlerts: vi.fn(),
  onRetryTelemetry: vi.fn(),
  onOpenSession: vi.fn(),
};

describe('OverviewPanel session count copy', () => {
  it('singularizes the subtitle at one session', () => {
    render(<OverviewPanel {...baseProps} sessionCount={1} />);
    expect(screen.getByText('Workspace spend across 1 session')).toBeDefined();
  });

  it('pluralizes the subtitle at two sessions', () => {
    render(<OverviewPanel {...baseProps} sessionCount={2} />);
    expect(screen.getByText('Workspace spend across 2 sessions')).toBeDefined();
  });

  it('pluralizes the subtitle at zero sessions', () => {
    render(<OverviewPanel {...baseProps} sessionCount={0} />);
    expect(screen.getByText('Workspace spend across 0 sessions')).toBeDefined();
  });
});
