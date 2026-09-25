import { describe, expect, it } from 'vitest';
import { groupByDay } from '../../shared/utils/groupByDay';
import type { InboxRecord } from './types';
import { orderInboxRecords } from './orderInboxRecords';

type RecordParams = {
  readonly key: string;
  readonly updatedAt: string;
  readonly state?: InboxRecord['state'];
};

const record = ({ key, updatedAt, state = 'open' }: RecordParams): InboxRecord => ({
  key,
  provider: 'github',
  kind: 'issue',
  identifier: key,
  title: key,
  state,
  stateLabel: 'Open',
  updatedAt,
  url: '',
  context: '',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 1,
      title: key,
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt,
    },
    sessionId: null,
  },
});

describe('orderInboxRecords', () => {
  it('orders by time only, newest first, whatever the state', () => {
    const ordered = orderInboxRecords({
      records: [
        record({ key: 'alert', state: 'alert', updatedAt: new Date(2026, 8, 4, 7).toISOString() }),
        record({ key: 'done', state: 'done', updatedAt: new Date(2026, 8, 4, 11).toISOString() }),
        record({ key: 'open', updatedAt: new Date(2026, 8, 4, 10).toISOString() }),
        record({ key: 'undated', updatedAt: '' }),
      ],
    });

    expect(ordered.map((item) => item.key)).toEqual(['done', 'open', 'alert', 'undated']);
  });

  it('keeps time order inside each day once grouped', () => {
    const days = groupByDay({
      now: new Date(2026, 8, 4, 12),
      timestampOf: (item) => item.updatedAt,
      items: orderInboxRecords({
        records: [
          record({ key: 'old-open', updatedAt: new Date(2026, 7, 20, 8).toISOString() }),
          record({ key: 'today-early', updatedAt: new Date(2026, 8, 4, 8).toISOString() }),
          record({
            key: 'today-late',
            state: 'alert',
            updatedAt: new Date(2026, 8, 4, 11).toISOString(),
          }),
        ],
      }),
    });

    expect(days.map((day) => [day.label, day.items.map((item) => item.key)])).toEqual([
      ['Today', ['today-late', 'today-early']],
      ['Older', ['old-open']],
    ]);
  });
});
