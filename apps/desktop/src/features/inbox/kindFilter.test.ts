import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { InboxRecord } from './types';
import {
  filterInboxRecords,
  NO_INBOX_FILTERS,
  activeFilterCount,
  inboxFacetCounts,
  matchesKindFilter,
  matchesSearch,
  visibleTypeFacets,
  type InboxFilters,
} from './kindFilter';

const record = (overrides: Partial<InboxRecord> & Pick<InboxRecord, 'key'>): InboxRecord => ({
  provider: 'github',
  kind: 'issue',
  identifier: '#0',
  title: 'untitled',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  stateLabel: 'Open',
  context: '',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 0,
      title: 'untitled',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: null,
  },
  ...overrides,
});

describe('matchesKindFilter', () => {
  it.each([
    ['all', 'issue', true],
    ['issue', 'issue', true],
    ['issue', 'pr', false],
    ['pr-mr', 'pr', true],
    ['pr-mr', 'mr', true],
    ['pr-mr', 'issue', false],
    ['thread', 'thread', true],
    ['error', 'error', true],
    ['error', 'issue', false],
  ] as const)('filter %s against kind %s is %s', (filter, kind, expected) => {
    expect(matchesKindFilter({ kind, filter })).toBe(expected);
  });
});

describe('matchesSearch', () => {
  const item = record({
    key: 'k1',
    title: 'Fix flaky test',
    identifier: '#41',
    stateLabel: 'Open',
    context: 'goodboy/goodboy',
  });

  it('matches on title, identifier or context case-insensitively', () => {
    expect(matchesSearch({ record: item, query: 'FLAKY' })).toBe(true);
    expect(matchesSearch({ record: item, query: '41' })).toBe(true);
    expect(matchesSearch({ record: item, query: 'goodboy' })).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesSearch({ record: item, query: '   ' })).toBe(true);
  });

  it('rejects a query that matches nothing', () => {
    expect(matchesSearch({ record: item, query: 'nope' })).toBe(false);
  });
});
const SESSION_ID = 'session-1' as SessionId;

const github = record({ key: 'a', provider: 'github', kind: 'issue', title: 'github item' });
const slack = record({
  key: 'b',
  provider: 'slack',
  kind: 'thread',
  state: 'active',
  title: 'slack thread',
});
const sentry = record({
  key: 'c',
  provider: 'sentry',
  kind: 'error',
  state: 'alert',
  title: 'sentry error',
});
const closed = record({ key: 'd', provider: 'github', state: 'done', title: 'closed item' });
const linked = record({
  key: 'e',
  provider: 'github',
  title: 'linked item',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 5,
      title: 'linked item',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: SESSION_ID,
  },
});
const records = [github, slack, sentry, closed, linked];

describe('filterInboxRecords', () => {
  it('applies view, type, source and search together', () => {
    const keys = (filters: InboxFilters, query = '') =>
      filterInboxRecords({ records, query, filters }).map((item) => item.key);

    expect(keys(NO_INBOX_FILTERS)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(keys({ ...NO_INBOX_FILTERS, view: 'in-progress' })).toEqual(['b']);
    expect(keys({ ...NO_INBOX_FILTERS, view: 'with-session' })).toEqual(['e']);
    expect(keys({ ...NO_INBOX_FILTERS, view: 'closed' })).toEqual(['d']);
    expect(keys({ ...NO_INBOX_FILTERS, kind: 'error' })).toEqual(['c']);
    expect(keys({ ...NO_INBOX_FILTERS, source: 'github' })).toEqual(['a', 'd', 'e']);
    expect(keys({ ...NO_INBOX_FILTERS, source: 'github' }, 'linked')).toEqual(['e']);
  });
});

describe('inboxFacetCounts', () => {
  it('counts each section against the other sections, never against itself', () => {
    const counts = inboxFacetCounts({
      records,
      query: '',
      filters: { ...NO_INBOX_FILTERS, source: 'github' },
    });

    expect(counts.view).toEqual({ all: 3, 'in-progress': 0, 'with-session': 1, closed: 1 });
    expect(counts.kind).toEqual({ issue: 3, 'pr-mr': 0, thread: 0, error: 0 });
    expect(counts.source.github).toBe(3);
    expect(counts.source.slack).toBe(1);
    expect(counts.source.sentry).toBe(1);
  });

  it('narrows every count by the search query', () => {
    const counts = inboxFacetCounts({ records, query: 'slack', filters: NO_INBOX_FILTERS });

    expect(counts.view.all).toBe(1);
    expect(counts.source.slack).toBe(1);
    expect(counts.source.github).toBe(0);
  });
});

describe('visibleTypeFacets', () => {
  it('shows only the types a connected tool can produce', () => {
    expect(visibleTypeFacets({ connected: ['github'] })).toEqual(['issue']);
    expect(visibleTypeFacets({ connected: ['gitlab', 'sentry'] })).toEqual([
      'issue',
      'pr-mr',
      'error',
    ]);
    expect(visibleTypeFacets({ connected: [] })).toEqual([]);
  });
});

describe('activeFilterCount', () => {
  it('counts one per section away from its default', () => {
    expect(activeFilterCount({ filters: NO_INBOX_FILTERS })).toBe(0);
    expect(
      activeFilterCount({ filters: { view: 'closed', kind: 'issue', source: 'github' } }),
    ).toBe(3);
  });
});
