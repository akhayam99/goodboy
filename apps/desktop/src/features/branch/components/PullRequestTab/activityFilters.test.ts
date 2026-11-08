import { describe, expect, it } from 'vitest';
import { activityFilterOptionsOf, activityItemsFor } from './activityFilters';
import type { ActivityItem } from './activityOf';

const AT = '2026-10-01T10:00:00Z';

const ITEMS: ReadonlyArray<ActivityItem> = [
  { kind: 'opened', key: 'opened', at: AT, who: 'nadia-p', isDraft: false },
  { kind: 'push', key: 'push:1', at: AT, who: 'nadia-p', count: 3, sha: 'a41c9e2' },
  {
    kind: 'review',
    key: 'review:1',
    at: AT,
    who: 'omar-t',
    verdict: 'approved',
    text: '',
  },
  {
    kind: 'review',
    key: 'review:2',
    at: AT,
    who: 'release-gate',
    verdict: 'approved',
    text: '',
    isBot: true,
  },
  {
    kind: 'bot',
    key: 'bot:acme-review',
    at: AT,
    who: 'acme-review',
    word: 'Commented',
    tone: 'neutral',
    notes: [],
  },
  {
    kind: 'checks',
    key: 'checks',
    at: AT,
    text: 'Checks 2 passed',
    isRunning: false,
    isFailing: false,
  },
];

const keysOf = (items: ReadonlyArray<ActivityItem>): ReadonlyArray<string> =>
  items.map((item) => item.key);

describe('activityItemsFor', () => {
  it('keeps everything on All', () => {
    expect(activityItemsFor({ items: ITEMS, filter: 'all' })).toHaveLength(ITEMS.length);
  });

  it('sorts the opening and the person reviews under People', () => {
    expect(keysOf(activityItemsFor({ items: ITEMS, filter: 'people' }))).toEqual([
      'opened',
      'review:1',
    ]);
  });

  it('puts bot rows and bot verdicts under Bots', () => {
    expect(keysOf(activityItemsFor({ items: ITEMS, filter: 'bots' }))).toEqual([
      'review:2',
      'bot:acme-review',
    ]);
  });

  it('sends every event of one app to Bots when the author type is unavailable', () => {
    const app = ({
      key,
      verdict,
    }: {
      readonly key: string;
      readonly verdict: 'approved' | 'commented' | 'changes_requested';
    }): ActivityItem => ({
      kind: 'review',
      key,
      at: AT,
      who: 'acme-review[bot]',
      verdict,
      text: 'No issues',
    });
    const items = [
      app({ key: 'review:c', verdict: 'commented' }),
      app({ key: 'review:a', verdict: 'approved' }),
      app({ key: 'review:x', verdict: 'changes_requested' }),
    ];

    expect(keysOf(activityItemsFor({ items, filter: 'bots' }))).toEqual([
      'review:c',
      'review:a',
      'review:x',
    ]);
    expect(activityItemsFor({ items, filter: 'people' })).toEqual([]);
  });

  it('keeps a person whose login ends in bot under People when the author type says so', () => {
    const items: ReadonlyArray<ActivityItem> = [
      {
        kind: 'review',
        key: 'review:acme-bot',
        at: AT,
        who: 'acme-bot',
        verdict: 'approved',
        text: '',
        isBot: false,
      },
    ];

    expect(keysOf(activityItemsFor({ items, filter: 'people' }))).toEqual(['review:acme-bot']);
    expect(activityItemsFor({ items, filter: 'bots' })).toEqual([]);
  });

  it('keeps the comments line out of Bots and under People only when a person commented', () => {
    const line = ({ hasPeople }: { readonly hasPeople: boolean }): ActivityItem => ({
      kind: 'comments',
      key: 'comments',
      at: AT,
      total: 2,
      needYou: 0,
      open: 2,
      hasPeople,
    });

    expect(activityItemsFor({ items: [line({ hasPeople: false })], filter: 'bots' })).toHaveLength(
      0,
    );
    expect(
      activityItemsFor({ items: [line({ hasPeople: false })], filter: 'people' }),
    ).toHaveLength(0);
    expect(activityItemsFor({ items: [line({ hasPeople: true })], filter: 'bots' })).toHaveLength(
      0,
    );
    expect(activityItemsFor({ items: [line({ hasPeople: true })], filter: 'people' })).toHaveLength(
      1,
    );
  });

  it('counts on Bots the bot rows the list shows, a finding comment line left out', () => {
    const items: ReadonlyArray<ActivityItem> = [
      ...ITEMS,
      {
        kind: 'comments',
        key: 'comments',
        at: AT,
        total: 1,
        needYou: 0,
        open: 1,
        hasPeople: false,
      },
    ];
    const bots = activityFilterOptionsOf({ items }).find((option) => option.value === 'bots');

    expect(bots?.count).toBe(2);
    expect(activityItemsFor({ items, filter: 'bots' }).map((item) => item.kind)).toEqual([
      'review',
      'bot',
    ]);
  });

  it('keeps the pushes and the checks apart', () => {
    expect(keysOf(activityItemsFor({ items: ITEMS, filter: 'pushes' }))).toEqual(['push:1']);
    expect(keysOf(activityItemsFor({ items: ITEMS, filter: 'checks' }))).toEqual(['checks']);
  });
});

describe('activityFilterOptionsOf', () => {
  it('counts each filter with the function that filters', () => {
    const options = activityFilterOptionsOf({ items: ITEMS });

    expect(options.map(({ value, count }) => [value, count])).toEqual([
      ['all', 6],
      ['people', 2],
      ['bots', 2],
      ['pushes', 1],
      ['checks', 1],
    ]);
    for (const option of options) {
      expect(option.count).toBe(activityItemsFor({ items: ITEMS, filter: option.value }).length);
    }
  });

  it('drops a filter with nothing in it', () => {
    const options = activityFilterOptionsOf({ items: ITEMS.slice(0, 2) });

    expect(options.map((option) => option.value)).toEqual(['all', 'people', 'pushes']);
  });
});
