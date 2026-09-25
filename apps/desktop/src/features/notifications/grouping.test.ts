import { describe, expect, it } from 'vitest';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import {
  groupByDay,
  groupNotifications,
  notificationGroupKey,
  sortNotificationGroupsNewestFirst,
} from './grouping';

type DeserializeParams = {
  readonly value: string;
};

const deserialize = <T>({ value }: DeserializeParams): T => JSON.parse(value);

const at = ({ value }: DeserializeParams): IsoDateTime =>
  deserialize({ value: JSON.stringify(value) });

const buildNotification = (overrides: Partial<Notification> = {}): Notification =>
  deserialize({
    value: JSON.stringify({
      id: 'n1',
      ts: at({ value: '2026-09-02T10:00:00.000Z' }),
      kind: 'error',
      title: 'Failure',
      body: null,
      severity: 'error',
      sessionId: null,
      workspaceId: null,
      read: false,
      action: null,
      coalesceKey: null,
      ...overrides,
    }),
  });

describe('notification grouping', () => {
  it('groups by coalesce key and preserves insertion order', () => {
    const first = buildNotification({ id: 'first', coalesceKey: 'retry' });
    const separate = buildNotification({ id: 'separate' });
    const repeated = buildNotification({ id: 'repeated', coalesceKey: 'retry' });

    expect(groupNotifications({ notifications: [first, separate, repeated] })).toEqual([
      [first, repeated],
      [separate],
    ]);
  });

  it('sorts groups and their members newest first', () => {
    const oldest = buildNotification({ id: 'oldest', coalesceKey: 'retry' });
    const newest = buildNotification({
      id: 'newest',
      coalesceKey: 'retry',
      ts: at({ value: '2026-09-02T12:00:00.000Z' }),
    });
    const middle = buildNotification({
      id: 'middle',
      ts: at({ value: '2026-09-02T11:00:00.000Z' }),
    });

    expect(sortNotificationGroupsNewestFirst({ notifications: [oldest, middle, newest] })).toEqual([
      [newest, oldest],
      [middle],
    ]);
  });

  it('keys a group by its latest coalesce key, falling back to the id', () => {
    const keyed = buildNotification({ id: 'a', coalesceKey: 'retry' });
    const loose = buildNotification({ id: 'b' });

    expect(notificationGroupKey({ group: [keyed] })).toBe('retry');
    expect(notificationGroupKey({ group: [loose] })).toBe('b');
  });

  it('splits groups into today, yesterday and earlier on local day boundaries', () => {
    const now = new Date(2026, 8, 2, 9, 0, 0);
    const today = buildNotification({
      id: 'today',
      ts: at({ value: new Date(2026, 8, 2, 0, 5).toISOString() }),
    });
    const yesterday = buildNotification({
      id: 'yesterday',
      ts: at({ value: new Date(2026, 8, 1, 23, 55).toISOString() }),
    });
    const earlier = buildNotification({
      id: 'earlier',
      ts: at({ value: new Date(2026, 7, 30, 12, 0).toISOString() }),
    });

    const days = groupByDay({ groups: [[today], [yesterday], [earlier]], now });

    expect(days.map((entry) => [entry.day, entry.groups.map((group) => group[0]?.id)])).toEqual([
      ['today', ['today']],
      ['yesterday', ['yesterday']],
      ['earlier', ['earlier']],
    ]);
  });

  it('leaves out a day with nothing in it', () => {
    const now = new Date(2026, 8, 2, 9, 0, 0);
    const earlier = buildNotification({
      id: 'earlier',
      ts: at({ value: new Date(2026, 7, 1).toISOString() }),
    });

    expect(groupByDay({ groups: [[earlier]], now }).map((entry) => entry.day)).toEqual(['earlier']);
  });
});
