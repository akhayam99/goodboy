import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_INBOX_FILTERS, type InboxFacetCounts, type InboxFilters } from '../../kindFilter';
import type { InboxProvider } from '../../types';
import { InboxFacetRail } from './InboxFacetRail';

const NONE: Readonly<Record<InboxProvider, number>> = {
  github: 0,
  gitlab: 0,
  linear: 0,
  jira: 0,
  sentry: 0,
  slack: 0,
  bitbucket: 0,
};

const COUNTS: InboxFacetCounts = {
  view: { all: 7, 'in-progress': 2, 'with-session': 1, closed: 0 },
  kind: { issue: 5, 'pr-mr': 0, thread: 0, error: 2 },
  source: { ...NONE, github: 5, sentry: 2 },
};

const NOT_LOADING: Readonly<Record<InboxProvider, boolean>> = {
  github: false,
  gitlab: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
  bitbucket: false,
};

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

type RenderParams = {
  readonly filters?: InboxFilters;
  readonly connected?: ReadonlyArray<InboxProvider>;
  readonly loading?: Readonly<Record<InboxProvider, boolean>>;
  readonly errors?: Readonly<Record<InboxProvider, string | null>>;
  readonly onFiltersChange?: (filters: InboxFilters) => void;
  readonly onClearFilters?: () => void;
};

const renderRail = ({
  filters = NO_INBOX_FILTERS,
  connected = ['github', 'sentry'],
  loading = NOT_LOADING,
  errors = NO_ERRORS,
  onFiltersChange = vi.fn(),
  onClearFilters = vi.fn(),
}: RenderParams = {}) =>
  render(
    <InboxFacetRail
      filters={filters}
      counts={COUNTS}
      connected={connected}
      loading={loading}
      errors={errors}
      onFiltersChange={onFiltersChange}
      onClearFilters={onClearFilters}
    />,
  );

afterEach(cleanup);

const section = (label: string) =>
  within(screen.getByRole('navigation', { name: 'Filter the inbox' })).getByRole('region', {
    name: label,
  });

describe('InboxFacetRail', () => {
  it('lists only the types a connected tool can produce', () => {
    renderRail();

    const type = section('Type');
    expect(within(type).getByRole('button', { name: /Issues/ })).toBeDefined();
    expect(within(type).getByRole('button', { name: /Errors/ })).toBeDefined();
    expect(within(type).queryByRole('button', { name: /Threads/ })).toBeNull();
    expect(within(type).queryByRole('button', { name: /Pull requests/ })).toBeNull();
  });

  it('picks one source at a time and clears it on a second click', () => {
    const onFiltersChange = vi.fn();
    const { unmount } = renderRail({ onFiltersChange });

    fireEvent.click(within(section('Source')).getByRole('button', { name: /GitHub/ }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...NO_INBOX_FILTERS, source: 'github' });
    unmount();

    renderRail({ filters: { ...NO_INBOX_FILTERS, source: 'github' }, onFiltersChange });
    fireEvent.click(within(section('Source')).getByRole('button', { name: /GitHub/ }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(NO_INBOX_FILTERS);
  });

  it("says a tool didn't load in place of its count, and pulses while it loads", () => {
    renderRail({
      errors: { ...NO_ERRORS, sentry: 'The token was refused (401).' },
      loading: { ...NOT_LOADING, github: true },
    });

    const sentry = within(section('Source')).getByRole('button', { name: /Sentry/ });
    expect(within(sentry).getByText("Didn't load")).toBeDefined();
    expect(within(sentry).queryByText('2')).toBeNull();
    const github = within(section('Source')).getByRole('button', { name: /GitHub/ });
    expect(within(github).getByRole('status', { name: 'Loading' })).toBeDefined();
  });

  it('offers clear filters only while a filter is active', () => {
    const onClearFilters = vi.fn();
    const { unmount } = renderRail();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderRail({ filters: { ...NO_INBOX_FILTERS, view: 'closed' }, onClearFilters });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('lists the inbox keys', () => {
    renderRail();

    expect(screen.getByText('Launch or open session')).toBeDefined();
    expect(screen.getByText('Open in the tool')).toBeDefined();
  });
});
