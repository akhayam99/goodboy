import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxProvider, InboxRecord } from '../../types';
import { InboxRail } from './InboxRail';

const HOUR = 60 * 60 * 1000;

type RecordParams = {
  readonly key: string;
  readonly provider?: InboxProvider;
  readonly identifier: string;
  readonly title: string;
  readonly updatedAt: string;
};

const record = ({
  key,
  provider = 'github',
  identifier,
  title,
  updatedAt,
}: RecordParams): InboxRecord => ({
  key,
  provider,
  kind: 'issue',
  identifier,
  title,
  state: 'open',
  updatedAt,
  url: '',
  meta: '',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 1,
      title,
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt,
    },
    sessionId: null,
  },
});

const now = Date.now();

const todayRecord = record({
  key: 'a',
  identifier: '#1',
  title: 'Today item',
  updatedAt: new Date(now - 2 * HOUR).toISOString(),
});

const yesterdayRecord = record({
  key: 'b',
  provider: 'linear',
  identifier: 'ENG-1',
  title: 'Yesterday item',
  updatedAt: new Date(now - 24 * HOUR).toISOString(),
});

const olderRecord = record({
  key: 'c',
  identifier: '#2',
  title: 'Older item',
  updatedAt: new Date(now - 30 * 24 * HOUR).toISOString(),
});

const records = [todayRecord, yesterdayRecord, olderRecord];

type RenderParams = {
  readonly selectedProviders?: ReadonlySet<InboxProvider>;
  readonly selectedKey?: string | null;
  readonly onSelect?: (record: InboxRecord) => void;
  readonly onActivate?: (record: InboxRecord) => void;
  readonly onClearFilters?: () => void;
  readonly onToggleProvider?: (provider: InboxProvider) => void;
};

const renderRail = ({
  selectedProviders = new Set<InboxProvider>(),
  selectedKey = null,
  onSelect = vi.fn(),
  onActivate = vi.fn(),
  onClearFilters = vi.fn(),
  onToggleProvider = vi.fn(),
}: RenderParams = {}) =>
  render(
    <InboxRail
      records={records}
      allRecords={records}
      selectedProviders={selectedProviders}
      onToggleProvider={onToggleProvider}
      query=""
      onQueryChange={vi.fn()}
      kindFilter="all"
      onKindFilterChange={vi.fn()}
      selectedKey={selectedKey}
      onSelect={onSelect}
      onActivate={onActivate}
      onClearFilters={onClearFilters}
      isLoading={false}
      errors={[]}
      onRefresh={vi.fn()}
    />,
  );

afterEach(() => cleanup());

describe('InboxRail', () => {
  it('labels every provider chip with its count', () => {
    renderRail();

    const group = screen.getByRole('group', { name: 'Filter by provider' });
    const chips = within(group).getAllByRole('button');

    expect(chips.map((chip) => chip.textContent)).toEqual(['GitHub2', 'Linear1']);
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'GitHub, 2 items',
      'Linear, 1 item',
    ]);
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('points aria-activedescendant at the selected option', () => {
    renderRail({ selectedKey: 'b' });

    const list = screen.getByRole('listbox', { name: 'Inbox items' });
    const selected = within(list)
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-selected') === 'true');

    expect(selected?.id).toBe('inbox-option-b');
    expect(list.getAttribute('aria-activedescendant')).toBe('inbox-option-b');
  });

  it('renders a selected provider that has no records and can toggle it off', () => {
    const onToggleProvider = vi.fn();
    renderRail({ selectedProviders: new Set<InboxProvider>(['jira']), onToggleProvider });

    const jiraChip = screen.getByRole('button', { name: /^Jira, / });

    expect(jiraChip.getAttribute('aria-pressed')).toBe('true');
    expect(jiraChip.textContent).toContain('0');

    fireEvent.click(jiraChip);

    expect(onToggleProvider).toHaveBeenCalledWith('jira');
  });

  it('separates the list into time sections', () => {
    renderRail();

    const list = screen.getByRole('listbox', { name: 'Inbox items' });

    expect(within(list).getByText('Today')).toBeDefined();
    expect(within(list).getByText('Yesterday')).toBeDefined();
    expect(within(list).getByText('Older')).toBeDefined();
    expect(within(list).queryByText('This week')).toBeNull();
  });

  it('moves the selection with the arrow keys, Home and End', () => {
    const onSelect = vi.fn();
    renderRail({ selectedKey: 'a', onSelect });

    const list = screen.getByRole('listbox', { name: 'Inbox items' });

    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(yesterdayRecord);

    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenLastCalledWith(todayRecord);

    fireEvent.keyDown(list, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(olderRecord);

    fireEvent.keyDown(list, { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(todayRecord);
  });

  it('activates the selected record on Enter', () => {
    const onActivate = vi.fn();
    const onSelect = vi.fn();
    renderRail({ selectedKey: 'b', onActivate, onSelect });

    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Inbox items' }), { key: 'Enter' });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]?.[0]?.key).toBe('b');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores Enter when nothing is selected', () => {
    const onActivate = vi.fn();
    renderRail({ selectedKey: null, onActivate });

    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Inbox items' }), { key: 'Enter' });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('offers to clear filters from the rail only once a filter is active', () => {
    const onClearFilters = vi.fn();
    const view = renderRail({ onClearFilters });
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    view.unmount();

    renderRail({ selectedProviders: new Set<InboxProvider>(['github']), onClearFilters });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('keeps the list focusable and hints at keyboard navigation', () => {
    renderRail();

    expect(screen.getByRole('listbox', { name: 'Inbox items' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('navigate')).toBeDefined();
    expect(screen.getByText('↑↓')).toBeDefined();
  });
});
