import { describe, expect, it } from 'vitest';
import type { InboxProvider, InboxRecord } from '../../../../inbox/types';
import { taskPickerRecord } from './testing/taskPickerRecord';
import { taskPickerView } from './taskPickerView';

type AgoParams = {
  readonly minutes: number;
};

const NOW = Date.parse('2026-11-16T12:00:00Z');

const ago = ({ minutes }: AgoParams): string => new Date(NOW - minutes * 60_000).toISOString();

const RECORDS: ReadonlyArray<InboxRecord> = [
  taskPickerRecord({
    provider: 'linear',
    id: 'HBL-12',
    title: 'Ledger export times out',
    updatedAt: ago({ minutes: 30 }),
  }),
  taskPickerRecord({
    provider: 'linear',
    id: 'HBL-9',
    title: 'Refund twice on retry',
    updatedAt: ago({ minutes: 5 }),
  }),
  taskPickerRecord({
    provider: 'github',
    id: '#418',
    title: 'Stream the ledger export',
    updatedAt: ago({ minutes: 10 }),
  }),
  taskPickerRecord({
    provider: 'sentry',
    id: 'NOTIFY-RELAY-2F',
    title: 'TypeError in webhook relay',
    updatedAt: ago({ minutes: 2 }),
  }),
  taskPickerRecord({
    provider: 'linear',
    id: 'HBL-3',
    title: 'Closed one',
    updatedAt: ago({ minutes: 1 }),
    state: 'done',
  }),
];

const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear', 'sentry', 'slack'];

type ItemsParams = {
  readonly records: ReadonlyArray<{ readonly record: InboxRecord }>;
};

const identifiersOf = ({ records }: ItemsParams): ReadonlyArray<string> =>
  records.map(({ record }) => record.identifier);

describe('taskPickerView', () => {
  it('lists open tasks grouped by source under All, newest first in each group', () => {
    const view = taskPickerView({
      records: RECORDS,
      connected: CONNECTED,
      source: 'all',
      query: '',
    });

    expect(view.sources).toEqual(['github', 'linear', 'sentry']);
    expect(view.isGrouped).toBe(true);
    expect(view.groups.map((group) => group.provider)).toEqual(['github', 'linear', 'sentry']);
    expect(identifiersOf({ records: view.items })).toEqual([
      '#418',
      'HBL-9',
      'HBL-12',
      'NOTIFY-RELAY-2F',
    ]);
    expect(view.counts).toEqual({ all: 4, github: 1, linear: 2, sentry: 1 });
  });

  it('filters by one source, flat and newest first', () => {
    const view = taskPickerView({
      records: RECORDS,
      connected: CONNECTED,
      source: 'linear',
      query: '',
    });

    expect(view.source).toBe('linear');
    expect(view.isGrouped).toBe(false);
    expect(identifiersOf({ records: view.items })).toEqual(['HBL-9', 'HBL-12']);
  });

  it('searches within the source and counts the matches per source', () => {
    const view = taskPickerView({
      records: RECORDS,
      connected: CONNECTED,
      source: 'linear',
      query: '  ledger EXPORT ',
    });

    expect(identifiersOf({ records: view.items })).toEqual(['HBL-12']);
    expect(view.counts).toEqual({ all: 2, github: 1, linear: 1, sentry: 0 });
  });

  it('matches the key and the context too', () => {
    const byKey = taskPickerView({
      records: RECORDS,
      connected: CONNECTED,
      source: 'all',
      query: 'hbl-9',
    });
    const byContext = taskPickerView({
      records: RECORDS,
      connected: CONNECTED,
      source: 'all',
      query: 'ledger-core',
    });

    expect(identifiersOf({ records: byKey.items })).toEqual(['HBL-9']);
    expect(byContext.counts.all).toBe(4);
  });

  it('reads a source that is no longer connected as All', () => {
    const view = taskPickerView({
      records: RECORDS.filter((record) => record.provider !== 'sentry'),
      connected: ['github', 'linear'],
      source: 'sentry',
      query: '',
    });

    expect(view.source).toBe('all');
    expect(view.sources).toEqual(['github', 'linear']);
  });

  it('keeps a connected source with no tasks yet as a filter', () => {
    const view = taskPickerView({
      records: [],
      connected: ['linear'],
      source: 'linear',
      query: '',
    });

    expect(view.sources).toEqual(['linear']);
    expect(view.source).toBe('linear');
    expect(view.items).toEqual([]);
  });
});
