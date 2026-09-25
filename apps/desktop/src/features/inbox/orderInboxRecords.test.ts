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
  updatedAt,
  url: '',
  meta: '',
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
  it('orders state priority before recency', () => {
    const ordered = orderInboxRecords({
      records: [
        record({ key: 'done', state: 'done', updatedAt: new Date(2026, 8, 4, 11).toISOString() }),
        record({ key: 'open', state: 'open', updatedAt: new Date(2026, 8, 4, 10).toISOString() }),
        record({
          key: 'active',
          state: 'active',
          updatedAt: new Date(2026, 8, 4, 9).toISOString(),
        }),
        record({
          key: 'alert-old',
          state: 'alert',
          updatedAt: new Date(2026, 8, 4, 7).toISOString(),
        }),
        record({
          key: 'alert-new',
          state: 'alert',
          updatedAt: new Date(2026, 8, 4, 8).toISOString(),
        }),
      ],
    });

    expect(ordered.map((item) => item.key)).toEqual([
      'alert-new',
      'alert-old',
      'active',
      'open',
      'done',
    ]);
  });

  it('keeps the state order inside each day once grouped', () => {
    const days = groupByDay({
      now: new Date(2026, 8, 4, 12),
      timestampOf: (item) => item.updatedAt,
      items: orderInboxRecords({
        records: [
          record({ key: 'old-open', updatedAt: new Date(2026, 7, 20, 8).toISOString() }),
          record({ key: 'today-open', updatedAt: new Date(2026, 8, 4, 11).toISOString() }),
          record({
            key: 'today-alert',
            state: 'alert',
            updatedAt: new Date(2026, 8, 4, 8).toISOString(),
          }),
        ],
      }),
    });

    expect(days.map((day) => [day.label, day.items.map((item) => item.key)])).toEqual([
      ['Today', ['today-alert', 'today-open']],
      ['Older', ['old-open']],
    ]);
  });
});
