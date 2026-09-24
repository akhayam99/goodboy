import { describe, expect, it } from 'vitest';
import type { Notification, NotificationCountBucket } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import {
  NO_NOTIFICATION_FILTERS,
  countNotificationFacets,
  filterNotificationGroups,
} from './facets';
import { notificationSource } from './source';

const buildNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  ts: '2026-09-02T10:00:00.000Z' as IsoDateTime,
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
});

const bucket = (overrides: Partial<NotificationCountBucket> = {}): NotificationCountBucket => ({
  severity: 'error',
  kind: 'error',
  hasSession: false,
  hasAction: false,
  read: true,
  inWorkspace: true,
  count: 1,
  ...overrides,
});

describe('notification facets', () => {
  it('matches a group when one member satisfies every active filter', () => {
    const readError = buildNotification({ id: 'read-error', read: true });
    const unreadWarning = buildNotification({ id: 'unread-warning', severity: 'warning' });
    const groups = [[readError, unreadWarning]];

    expect(
      filterNotificationGroups({
        groups,
        filters: { ...NO_NOTIFICATION_FILTERS, view: 'unread', severity: 'warning' },
      }),
    ).toEqual(groups);
    expect(
      filterNotificationGroups({
        groups,
        filters: { ...NO_NOTIFICATION_FILTERS, view: 'unread', severity: 'error' },
      }),
    ).toEqual([]);
  });

  it('files success under info and an action under needs action', () => {
    const success = buildNotification({
      id: 'done',
      severity: 'success',
      action: { kind: 'retry-update' },
    });

    expect(
      filterNotificationGroups({
        groups: [[success]],
        filters: { view: 'action', severity: 'info', source: null },
      }),
    ).toEqual([[success]]);
  });

  it('counts each facet under the other active filters, inside the workspace scope', () => {
    const buckets = [
      bucket({ count: 4, read: false }),
      bucket({ severity: 'warning', count: 2, hasAction: true }),
      bucket({ severity: 'success', kind: 'pr-created', count: 3, hasSession: true }),
      bucket({ count: 5, inWorkspace: false }),
    ];

    const counts = countNotificationFacets({
      buckets,
      filters: { ...NO_NOTIFICATION_FILTERS, severity: 'error' },
      isWorkspaceScoped: true,
    });

    expect(counts).toMatchObject({
      total: 9,
      unread: 4,
      matching: 4,
      view: { all: 4, unread: 4, action: 0 },
      severity: { error: 4, warning: 2, info: 3 },
      source: { system: 4, 'pull-requests': 0 },
      workspace: 9,
      all: 14,
    });
  });

  it('files errors by whether a session owns them', () => {
    expect(notificationSource({ kind: 'error', hasSession: true })).toBe('sessions');
    expect(notificationSource({ kind: 'error', hasSession: false })).toBe('system');
    expect(notificationSource({ kind: 'summarizer-degraded', hasSession: true })).toBe('agents');
  });
});
