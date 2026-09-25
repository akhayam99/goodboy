import { describe, expect, it } from 'vitest';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import {
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
});
