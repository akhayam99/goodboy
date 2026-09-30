import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import type { InboxRecord } from '../../types';

const { rowRenders } = vi.hoisted(() => ({ rowRenders: { current: 0 } }));

vi.mock('../../../../shared/hooks/useNow', () => ({
  useNow: () => {
    rowRenders.current += 1;
    return Date.parse('2026-09-04T12:00:00.000Z');
  },
}));

const { InboxList } = await import('./InboxList');

const NOW = new Date('2026-09-04T12:00:00.000Z');

const record = (index: number): InboxRecord => ({
  key: `CAS-${index}`,
  provider: 'github',
  kind: 'issue',
  identifier: `CAS-${index}`,
  title: `Item ${index}`,
  state: 'open',
  stateLabel: 'Todo',
  updatedAt: new Date(NOW.getTime() - index * 60_000).toISOString(),
  url: '',
  context: 'Cascadia',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: index,
      title: '',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: null,
  },
});

const RECORDS = Array.from({ length: 12 }, (_, index) => record(index));
const onSelect = vi.fn();
const onActivate = vi.fn();
const onToggleStar = vi.fn();
const onRetry = vi.fn();
const onOpenSettings = vi.fn();
const onClearFilters = vi.fn();

const list = ({ selectedKey }: { readonly selectedKey: string | null }) => (
  <InboxList
    days={groupByDay({ items: RECORDS, timestampOf: (item) => item.updatedAt, now: NOW })}
    totalCount={RECORDS.length}
    connectedCount={1}
    isLoading={false}
    failures={[]}
    hasFiltersActive={false}
    selectedKey={selectedKey}
    onSelect={onSelect}
    onActivate={onActivate}
    onRetry={onRetry}
    onOpenSettings={onOpenSettings}
    onClearFilters={onClearFilters}
    starOf={() => false}
    onToggleStar={onToggleStar}
  />
);

beforeEach(() => {
  rowRenders.current = 0;
});

afterEach(cleanup);

describe('InboxList, row renders', () => {
  it('re-renders only the rows that gain or lose the selection', () => {
    const view = render(list({ selectedKey: 'CAS-0' }));
    rowRenders.current = 0;

    view.rerender(list({ selectedKey: 'CAS-1' }));

    expect(rowRenders.current).toBe(2);
  });

  it('re-renders no row when the parent re-renders with the same records', () => {
    const view = render(list({ selectedKey: 'CAS-0' }));
    rowRenders.current = 0;

    view.rerender(list({ selectedKey: 'CAS-0' }));

    expect(rowRenders.current).toBe(0);
  });
});
