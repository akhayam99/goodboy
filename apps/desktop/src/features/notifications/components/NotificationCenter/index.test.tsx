// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    notificationCounts: { total: 0, unread: 0 },
    notificationsLoading: false,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
    dismissNotification: vi.fn(async () => undefined),
    markNotificationRead: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
    retryStepSummary: vi.fn(async () => undefined),
    sessions: [] as ReadonlyArray<{
      readonly id: string;
      readonly goal: string;
      readonly providerPreference?: unknown;
    }>,
    providers: [] as ReadonlyArray<{ readonly id: string; readonly connection: string }>,
    currentWorkspaceId: 'ws-1' as string | null,
    currentSessionId: null as string | null,
    setCurrentSession: vi.fn(async () => undefined),
    setCurrentWorkspace: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (storeState: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return { useAppStore };
});

import { NotificationCenter } from './index';

type BuildNotificationParams = {
  readonly id: string;
  readonly title: string;
  readonly coalesceKey: string;
  readonly read?: boolean;
  readonly sessionId?: string | null;
  readonly ts?: string;
};

const buildNotification = ({
  id,
  title,
  coalesceKey,
  read = false,
  sessionId = null,
  ts = '2026-08-31T12:00:00.000Z',
}: BuildNotificationParams): Notification =>
  ({
    id,
    title,
    coalesceKey,
    read,
    sessionId,
    ts: ts as IsoDateTime,
    kind: 'error',
    body: null,
    severity: 'warning',
    workspaceId: sessionId != null ? 'ws-1' : null,
    action: null,
  }) as Notification;

const openCenter = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
  });
};

beforeEach(() => {
  state.notifications = [];
  state.notificationCounts = { total: 0, unread: 0 };
  state.sessions = [];
  state.currentSessionId = null;
  state.loadNotifications.mockClear();
  state.markNotificationsRead.mockClear();
  state.dismissNotification.mockClear();
  state.markNotificationRead.mockClear();
  state.setCurrentSession.mockClear();
  state.selectAgent.mockClear();
});

afterEach(cleanup);

describe('NotificationCenter', () => {
  it('renders the specified empty state and marks all read on open', async () => {
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByText('No notifications')).toBeDefined();
    expect(screen.getByText('Run activity and alerts land here.')).toBeDefined();
    expect(state.markNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('coalesces three rows and uses the newest title', async () => {
    state.notifications = [
      buildNotification({ id: 'n3', title: 'newest title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n2', title: 'middle title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n1', title: 'oldest title', coalesceKey: 'shared' }),
    ];
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByText('newest title')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.queryByText('middle title')).toBeNull();
  });

  it('expands a group to show its entries and studio link', async () => {
    state.notifications = [
      buildNotification({ id: 'n2', title: 'newest title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n1', title: 'older title', coalesceKey: 'shared' }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Expand notifications' }));

    expect(screen.getByText('older title')).toBeDefined();
    expect(screen.getByRole('button', { name: 'View all in studio' })).toBeDefined();
  });

  it('dismisses every notification in a group', async () => {
    state.notifications = [
      buildNotification({ id: 'n2', title: 'newest title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n1', title: 'older title', coalesceKey: 'shared' }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss group' }));

    expect(state.dismissNotification).toHaveBeenCalledTimes(2);
    expect(state.markNotificationRead).toHaveBeenCalledTimes(2);
    expect(state.dismissNotification).toHaveBeenCalledWith('n2');
    expect(state.dismissNotification).toHaveBeenCalledWith('n1');
  });

  it('counts unread groups in the trigger and header', async () => {
    state.notifications = [
      buildNotification({ id: 'n3', title: 'same group unread', coalesceKey: 'shared' }),
      buildNotification({ id: 'n2', title: 'same group read', coalesceKey: 'shared', read: true }),
      buildNotification({ id: 'n1', title: 'other group', coalesceKey: 'other', read: true }),
    ];
    render(<NotificationCenter />);

    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeDefined();
    await openCenter();
    expect(screen.getByText('1 unread · 2 total')).toBeDefined();
  });

  it('navigates from a single-entry group with a target', async () => {
    state.sessions = [{ id: 'session-1', goal: 'Ship grouping' }];
    state.notifications = [
      buildNotification({
        id: 'n1',
        title: 'open session',
        coalesceKey: 'single',
        sessionId: 'session-1',
      }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('button', { name: 'open session' }));

    expect(state.setCurrentSession).toHaveBeenCalledWith('session-1');
  });
});
