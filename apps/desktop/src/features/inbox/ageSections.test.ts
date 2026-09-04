import { describe, expect, it } from 'vitest';
import type { InboxRecord } from './types';
import { groupRecordsByAge } from './ageSections';

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

describe('groupRecordsByAge', () => {
  const now = new Date(2026, 8, 4, 12).getTime();

  it('groups records by calendar age using the injected time', () => {
    const sections = groupRecordsByAge({
      now,
      records: [
        record({ key: 'today', updatedAt: new Date(2026, 8, 4, 8).toISOString() }),
        record({ key: 'yesterday', updatedAt: new Date(2026, 8, 3, 8).toISOString() }),
        record({ key: 'week', updatedAt: new Date(2026, 7, 31, 8).toISOString() }),
        record({ key: 'older', updatedAt: new Date(2026, 7, 30, 8).toISOString() }),
      ],
    });

    expect(sections.map((section) => section.label)).toEqual([
      'Today',
      'Yesterday',
      'This week',
      'Older',
    ]);
    expect(sections.map((section) => section.records[0]?.key)).toEqual([
      'today',
      'yesterday',
      'week',
      'older',
    ]);
  });

  it('orders state priority before recency inside a section', () => {
    const sections = groupRecordsByAge({
      now,
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

    expect(sections[0]?.records.map((item) => item.key)).toEqual([
      'alert-new',
      'alert-old',
      'active',
      'open',
      'done',
    ]);
  });

  it('does not depend on the current clock when now is injected', () => {
    const sections = groupRecordsByAge({
      now,
      records: [record({ key: 'fixed', updatedAt: new Date(2026, 8, 4, 1).toISOString() })],
    });

    expect(sections[0]?.key).toBe('today');
  });
});
