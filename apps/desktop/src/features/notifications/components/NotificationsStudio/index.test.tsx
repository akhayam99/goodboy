// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: Object.freeze(Array<Notification>()),
    notificationCounts: { total: 0, unread: 0 },
    notificationsLoading: false,
    sessions: [],
    workspaces: [],
    loadNotifications: vi.fn(async () => undefined),
    markNotificationRead: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    dismissNotification: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
    retryStepSummary: vi.fn(async () => undefined),
    summarizerStatus: {},
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (store: typeof state) => T) => selector(state);
  Object.assign(useAppStore, { getState: () => state });
  return { useAppStore };
});

import { NotificationsStudio } from './index';

type DeserializeParams = {
  readonly value: string;
};

const deserialize = <T,>({ value }: DeserializeParams): T => JSON.parse(value);

const at = ({ value }: DeserializeParams): IsoDateTime =>
  deserialize({ value: JSON.stringify(value) });

const buildNotification = (overrides: Partial<Notification> = {}): Notification =>
  deserialize({
    value: JSON.stringify({
      id: 'n1',
      ts: at({ value: '2026-09-02T10:00:00.000Z' }),
      kind: 'error',
      title: 'Summarizer failed',
      body: 'Could not parse the reply.',
      severity: 'error',
      sessionId: null,
      workspaceId: null,
      read: false,
      action: null,
      coalesceKey: null,
      ...overrides,
    }),
  });

const seedNotifications = ({ notifications }: { notifications: ReadonlyArray<Notification> }) => {
  state.notifications = notifications;
  state.notificationCounts = {
    total: notifications.length,
    unread: notifications.filter((notification) => notification.read === false).length,
  };
};

const renderStudio = () =>
  render(<NotificationsStudio workspaceName="goodboy" onClose={vi.fn()} />);

beforeEach(() => {
  state.notifications = [];
  state.notificationCounts = { total: 0, unread: 0 };
  state.notificationsLoading = false;
  state.loadNotifications.mockClear();
  state.markNotificationRead.mockClear();
  state.markNotificationsRead.mockClear();
  state.dismissNotification.mockClear();
  state.clearNotifications.mockClear();
});

afterEach(cleanup);

describe('NotificationsStudio', () => {
  it('renders repeated notifications as one row with a count badge', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'older', coalesceKey: 'retry', title: 'Older failure' }),
        buildNotification({
          id: 'latest',
          coalesceKey: 'retry',
          title: 'Latest failure',
          ts: at({ value: '2026-09-02T11:00:00.000Z' }),
        }),
      ],
    });
    renderStudio();

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Latest failure')).toBeDefined();
    expect(screen.getByLabelText('2 notifications')).toBeDefined();
    expect(screen.queryByText('Older failure')).toBeNull();
  });

  it('expands a group to reveal older members', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'older', coalesceKey: 'retry', title: 'Older failure' }),
        buildNotification({ id: 'latest', coalesceKey: 'retry', title: 'Latest failure' }),
      ],
    });
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Expand notifications' }));

    expect(screen.getByText('Older failure')).toBeDefined();
  });

  it('filters groups by severity', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'error', title: 'Error row' }),
        buildNotification({ id: 'warning', title: 'Warning row', severity: 'warning' }),
      ],
    });
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Warnings' }));

    expect(screen.getByText('Warning row')).toBeDefined();
    expect(screen.queryByText('Error row')).toBeNull();
  });

  it('filters groups to unread only', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'unread', title: 'Unread row' }),
        buildNotification({ id: 'read', title: 'Read row', read: true }),
      ],
    });
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: /unread only/i }));

    expect(screen.getByText('Unread row')).toBeDefined();
    expect(screen.queryByText('Read row')).toBeNull();
  });

  it('marks every member in a group read', async () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'first', coalesceKey: 'retry' }),
        buildNotification({ id: 'second', coalesceKey: 'retry' }),
      ],
    });
    renderStudio();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /mark "summarizer failed" group as read/i }),
      );
    });

    expect(state.markNotificationRead).toHaveBeenCalledTimes(2);
    expect(state.markNotificationRead).toHaveBeenCalledWith('first');
    expect(state.markNotificationRead).toHaveBeenCalledWith('second');
  });

  it('dismisses every member in a group', async () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'first', coalesceKey: 'retry' }),
        buildNotification({ id: 'second', coalesceKey: 'retry' }),
      ],
    });
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /dismiss "summarizer failed" group/i }));
    });

    expect(state.dismissNotification).toHaveBeenCalledTimes(2);
    expect(state.dismissNotification).toHaveBeenCalledWith('first');
    expect(state.dismissNotification).toHaveBeenCalledWith('second');
  });

  it('keeps bulk mark-read and armed delete-all actions', async () => {
    seedNotifications({ notifications: [buildNotification()] });
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(state.markNotificationsRead).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    expect(state.clearNotifications).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^delete all$/i }));
    });
    expect(state.clearNotifications).toHaveBeenCalledOnce();
  });

  it('shows a filtered empty state and clears filters', () => {
    seedNotifications({ notifications: [buildNotification()] });
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Warnings' }));
    expect(screen.getByRole('heading', { name: 'No notifications match' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Summarizer failed')).toBeDefined();
  });
});
