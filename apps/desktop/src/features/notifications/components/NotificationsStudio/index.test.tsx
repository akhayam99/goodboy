// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Notification, NotificationCountBucket } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: Object.freeze(Array<Notification>()),
    notificationCounts: Array<NotificationCountBucket>(),
    notificationScope: 'workspace',
    hasOlderNotifications: false,
    notificationsLoading: false,
    currentWorkspaceId: 'ws-1',
    sessions: [],
    workspaces: [{ id: 'ws-1', name: 'Harborline' }],
    loadNotifications: vi.fn(async () => undefined),
    loadOlderNotifications: vi.fn(async () => undefined),
    setNotificationScope: vi.fn(async () => undefined),
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
  state.notificationCounts = notifications.map((notification) => ({
    severity: notification.severity,
    kind: notification.kind,
    hasSession: notification.sessionId != null,
    hasAction: notification.action != null,
    read: notification.read,
    inWorkspace: true,
    count: 1,
  }));
};

const renderStudio = () => render(<NotificationsStudio onClose={vi.fn()} />);

beforeEach(() => {
  state.notifications = [];
  state.notificationCounts = [];
  state.notificationsLoading = false;
  state.hasOlderNotifications = false;
  state.loadNotifications.mockClear();
  state.loadOlderNotifications.mockClear();
  state.setNotificationScope.mockClear();
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

    const list = screen.getByRole('region', { name: 'Older' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Latest failure')).toBeDefined();
    expect(screen.getByLabelText('2 notifications')).toBeDefined();
    expect(screen.queryByText('Older failure')).toBeNull();
  });

  it('opens a row in place with its body and the older members of the group', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'older', coalesceKey: 'retry', title: 'Older failure' }),
        buildNotification({ id: 'latest', coalesceKey: 'retry', title: 'Latest failure' }),
      ],
    });
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Older failure' }));

    expect(
      screen.getByRole('button', { name: 'Older failure' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByRole('list', { name: 'Earlier in this group' })).toBeDefined();
    expect(screen.getByRole('button', { name: /send to developers/i })).toBeDefined();
    expect(state.markNotificationRead).toHaveBeenCalledTimes(2);
  });

  it('counts every facet and filters by severity from the rail', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'error', title: 'Error row' }),
        buildNotification({ id: 'warning', title: 'Warning row', severity: 'warning' }),
      ],
    });
    renderStudio();

    const rail = screen.getByRole('navigation', { name: 'Filter notifications' });
    expect(within(rail).getByRole('button', { name: /errors 1/i })).toBeDefined();
    fireEvent.click(within(rail).getByRole('button', { name: /warnings/i }));

    expect(screen.getByText('Warning row')).toBeDefined();
    expect(screen.queryByText('Error row')).toBeNull();
    expect(
      within(rail)
        .getByRole('button', { name: /warnings/i })
        .getAttribute('aria-current'),
    ).toBe('true');
  });

  it('filters to unread and to rows that need an action', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'unread', title: 'Unread row' }),
        buildNotification({
          id: 'read',
          title: 'Read row',
          read: true,
          action: deserialize({ value: JSON.stringify({ kind: 'retry-update' }) }),
        }),
      ],
    });
    renderStudio();
    const rail = screen.getByRole('navigation', { name: 'Filter notifications' });

    fireEvent.click(within(rail).getByRole('button', { name: /^unread/i }));
    expect(screen.getByText('Unread row')).toBeDefined();
    expect(screen.queryByText('Read row')).toBeNull();

    fireEvent.click(within(rail).getByRole('button', { name: /needs action/i }));
    expect(screen.getByText('Read row')).toBeDefined();
    expect(screen.queryByText('Unread row')).toBeNull();
  });

  it('defaults to this workspace and switches to every workspace', () => {
    seedNotifications({ notifications: [buildNotification()] });
    renderStudio();

    expect(screen.getByRole('tab', { name: /harborline/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: /all/i }));

    expect(state.setNotificationScope).toHaveBeenCalledWith('all');
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
      fireEvent.click(screen.getByRole('button', { name: /mark "summarizer failed" read/i }));
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
      fireEvent.click(screen.getByRole('button', { name: /dismiss "summarizer failed"/i }));
    });

    expect(state.dismissNotification).toHaveBeenCalledTimes(2);
    expect(state.dismissNotification).toHaveBeenCalledWith('first');
    expect(state.dismissNotification).toHaveBeenCalledWith('second');
  });

  it('moves with j, dismisses with e, and leaves the row list keyboard only', () => {
    seedNotifications({
      notifications: [
        buildNotification({
          id: 'top',
          title: 'Top row',
          ts: at({ value: '2026-09-02T12:00:00.000Z' }),
        }),
        buildNotification({ id: 'bottom', title: 'Bottom row' }),
      ],
    });
    renderStudio();

    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByRole('button', { name: 'Top row' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByRole('button', { name: 'Bottom row' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.keyDown(window, { key: 'e' });

    expect(state.dismissNotification).toHaveBeenCalledWith('bottom');
  });

  it('reserves the unread slot on every row and fills it only on unread rows', () => {
    seedNotifications({
      notifications: [
        buildNotification({ id: 'n1', title: 'New one', coalesceKey: 'a' }),
        buildNotification({ id: 'n2', title: 'Seen one', coalesceKey: 'b', read: true }),
      ],
    });
    renderStudio();

    const slots = ['New one', 'Seen one'].map((title) =>
      screen
        .getByRole('heading', { name: title })
        .closest('li')
        ?.querySelector('[data-unread-slot]'),
    );
    expect(slots.map((slot) => slot?.childElementCount)).toEqual([1, 0]);
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);
  });

  it('keeps the primary action visible and reserves the hover slot for row actions', () => {
    seedNotifications({
      notifications: [
        buildNotification({
          action: deserialize({
            value: JSON.stringify({
              kind: 'retry-step-summary',
              sessionId: 'session-1',
              agentId: 'agent-1',
            }),
          }),
        }),
      ],
    });
    renderStudio();

    const slot = screen
      .getByRole('button', { name: /dismiss "summarizer failed"/i })
      .closest('span');
    expect(slot?.className).toContain('group-hover:opacity-100');
    expect(slot?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(slot?.contains(screen.getByRole('button', { name: 'Retry' }))).toBe(false);
  });

  it('offers older notifications and says how many are loaded', () => {
    seedNotifications({ notifications: [buildNotification()] });
    state.hasOlderNotifications = true;
    state.notificationCounts = [{ ...state.notificationCounts[0]!, count: 12 }];
    renderStudio();

    expect(screen.getByText('Showing 1 of 12')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Load older' }));

    expect(state.loadOlderNotifications).toHaveBeenCalledOnce();
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

    fireEvent.click(screen.getByRole('button', { name: /warnings/i }));
    expect(screen.getByRole('heading', { name: 'No notifications match' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Summarizer failed')).toBeDefined();
  });
});
