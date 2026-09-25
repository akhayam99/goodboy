import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import type { InboxProvider, InboxRecord } from '../../types';
import { InboxList, type InboxLoadFailure } from './InboxList';

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 8, 4, 12);

type RecordParams = {
  readonly key: string;
  readonly provider?: InboxProvider;
  readonly title: string;
  readonly hoursAgo: number;
};

const record = ({ key, provider = 'github', title, hoursAgo }: RecordParams): InboxRecord => ({
  key,
  provider,
  kind: 'issue',
  identifier: key,
  title,
  state: 'open',
  stateLabel: 'Todo',
  updatedAt: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(),
  url: '',
  context: 'Cascadia',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: { number: 1, title, body: '', url: '', state: 'OPEN', labels: [], updatedAt: '' },
    sessionId: null,
  },
});

const RECORDS = [
  record({ key: 'CAS-1', title: 'Today item', hoursAgo: 2 }),
  record({ key: 'CAS-2', title: 'Old item', hoursAgo: 24 * 30 }),
];

type RenderParams = {
  readonly records?: ReadonlyArray<InboxRecord>;
  readonly totalCount?: number;
  readonly connectedCount?: number;
  readonly isLoading?: boolean;
  readonly failures?: ReadonlyArray<InboxLoadFailure>;
  readonly selectedKey?: string | null;
  readonly onRetry?: () => void;
  readonly onOpenSettings?: () => void;
  readonly onClearFilters?: () => void;
};

const renderList = ({
  records = RECORDS,
  totalCount = records.length,
  connectedCount = 1,
  isLoading = false,
  failures = [],
  selectedKey = null,
  onRetry = vi.fn(),
  onOpenSettings = vi.fn(),
  onClearFilters = vi.fn(),
}: RenderParams = {}) =>
  render(
    <InboxList
      days={groupByDay({ items: records, timestampOf: (item) => item.updatedAt, now: NOW })}
      totalCount={totalCount}
      connectedCount={connectedCount}
      isLoading={isLoading}
      failures={failures}
      hasFiltersActive
      selectedKey={selectedKey}
      onSelect={vi.fn()}
      onRetry={onRetry}
      onOpenSettings={onOpenSettings}
      onClearFilters={onClearFilters}
    />,
  );

afterEach(cleanup);

describe('InboxList', () => {
  it('groups rows by day with a count per day', () => {
    renderList();

    const listbox = screen.getByRole('listbox', { name: 'Inbox items' });
    expect(
      within(within(listbox).getByRole('group', { name: 'Today' })).getByText('Today item'),
    ).toBeDefined();
    expect(
      within(within(listbox).getByRole('group', { name: 'Older' })).getByText('Old item'),
    ).toBeDefined();
  });

  it('points aria-activedescendant at the selected option', () => {
    renderList({ selectedKey: 'CAS-2' });

    const listbox = screen.getByRole('listbox', { name: 'Inbox items' });
    const option = screen.getByRole('option', { name: /Old item/ });
    expect(listbox.getAttribute('aria-activedescendant')).toBe(option.id);
    expect(option.getAttribute('aria-selected')).toBe('true');
  });

  it('says one tool did not load in one notice, with retry and settings', () => {
    const onRetry = vi.fn();
    const onOpenSettings = vi.fn();
    renderList({
      failures: [{ provider: 'sentry', message: 'The token was refused (401).' }],
      onRetry,
      onOpenSettings,
    });

    expect(screen.getByText("Sentry didn't load.")).toBeDefined();
    expect(screen.getByText('The token was refused (401).')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('names every tool that failed in one notice and keeps the reasons behind details', () => {
    renderList({
      failures: [
        { provider: 'jira', message: 'Timed out' },
        { provider: 'sentry', message: 'The token was refused (401).' },
      ],
    });

    expect(screen.getByText("Jira and Sentry didn't load.")).toBeDefined();
    expect(screen.queryByText(/Timed out/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText(/Jira: Timed out/)).toBeDefined();
  });

  it('shows skeleton rows only until the first row arrives', () => {
    renderList({ records: [], totalCount: 0, isLoading: true });

    expect(screen.getByRole('status', { name: 'Loading the inbox' })).toBeDefined();
  });

  it('asks to connect a tool when none is connected', () => {
    const onOpenSettings = vi.fn();
    renderList({ records: [], totalCount: 0, connectedCount: 0, onOpenSettings });

    expect(screen.getByText('Connect a tool to fill the inbox')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Connect a tool' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('says nothing is assigned when connected tools return nothing', () => {
    renderList({ records: [], totalCount: 0 });

    expect(screen.getByText('Nothing assigned to you')).toBeDefined();
  });

  it('offers to clear filters when they hide every item', () => {
    const onClearFilters = vi.fn();
    renderList({ records: [], totalCount: 4, onClearFilters });

    expect(screen.getByText('No items match these filters')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
