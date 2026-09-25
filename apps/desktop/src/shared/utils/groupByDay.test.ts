import { describe, expect, it } from 'vitest';
import { groupByDay } from './groupByDay';

type Item = {
  readonly id: string;
  readonly at: string;
};

type ItemParams = {
  readonly id: string;
  readonly date: Date;
};

const item = ({ id, date }: ItemParams): Item => ({ id, at: date.toISOString() });

const timestampOf = (entry: Item) => entry.at;

describe('groupByDay', () => {
  const now = new Date(2026, 8, 4, 12);

  it('splits items into today, yesterday, this week and older on local day boundaries', () => {
    const days = groupByDay({
      now,
      timestampOf,
      items: [
        item({ id: 'today', date: new Date(2026, 8, 4, 0, 5) }),
        item({ id: 'yesterday', date: new Date(2026, 8, 3, 23, 55) }),
        item({ id: 'week', date: new Date(2026, 7, 31, 8) }),
        item({ id: 'older', date: new Date(2026, 7, 30, 8) }),
      ],
    });

    expect(days.map((group) => [group.label, group.items.map((entry) => entry.id)])).toEqual([
      ['Today', ['today']],
      ['Yesterday', ['yesterday']],
      ['This week', ['week']],
      ['Older', ['older']],
    ]);
  });

  it('keeps the input order inside a day', () => {
    const days = groupByDay({
      now,
      timestampOf,
      items: [
        item({ id: 'morning', date: new Date(2026, 8, 4, 8) }),
        item({ id: 'late', date: new Date(2026, 8, 4, 11) }),
        item({ id: 'early', date: new Date(2026, 8, 4, 1) }),
      ],
    });

    expect(days[0]?.items.map((entry) => entry.id)).toEqual(['morning', 'late', 'early']);
  });

  it('leaves out a day with nothing in it and puts an unreadable time in older', () => {
    const days = groupByDay({
      now,
      timestampOf,
      items: [
        item({ id: 'today', date: new Date(2026, 8, 4, 9) }),
        { id: 'broken', at: 'not a date' },
      ],
    });

    expect(days.map((group) => group.day)).toEqual(['today', 'older']);
    expect(days[1]?.items.map((entry) => entry.id)).toEqual(['broken']);
  });

  it('files the day before a Monday under yesterday, not this week', () => {
    const monday = new Date(2026, 8, 7, 9);
    const days = groupByDay({
      now: monday,
      timestampOf,
      items: [item({ id: 'sunday', date: new Date(2026, 8, 6, 20) })],
    });

    expect(days.map((group) => group.day)).toEqual(['yesterday']);
  });
});
