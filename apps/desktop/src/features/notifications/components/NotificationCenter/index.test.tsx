// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
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
    reportError: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ readonly id: string; readonly name: string }>,
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (storeState: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return { useAppStore };
});

import { NotificationCenter } from './index';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../studioEvent';

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
  state.reportError.mockClear();
  state.workspaces = [];
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

  it('sends history management to the studio instead of deleting from the bell', async () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'build failed', coalesceKey: 'build' }),
    ];
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open all' }));

    expect(listener).toHaveBeenCalledOnce();
    expect(state.clearNotifications).not.toHaveBeenCalled();
    expect(screen.queryByText('build failed')).toBeNull();
    window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
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

  it('expands a group to show its entries, leaving the studio link in the header', async () => {
    state.notifications = [
      buildNotification({ id: 'n2', title: 'newest title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n1', title: 'older title', coalesceKey: 'shared' }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Expand notifications' }));

    expect(screen.getByText('older title')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'View all in studio' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open all' })).toBeDefined();
  });

  it('opens the studio from the header with no notifications at all', async () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
    render(<NotificationCenter />);
    await openCenter();

    fireEvent.click(screen.getByRole('button', { name: 'Open all' }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
  });

  it('marks each row with its severity and the studio context line', async () => {
    state.sessions = [{ id: 'session-1', goal: 'Ship grouping' }];
    state.workspaces = [{ id: 'ws-1', name: 'Harborline' }];
    state.notifications = [
      buildNotification({
        id: 'n1',
        title: 'Handoff degraded',
        coalesceKey: 'single',
        sessionId: 'session-1',
      }),
    ];
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByLabelText('Warning')).toBeDefined();
    expect(screen.getByText('Harborline · Ship grouping')).toBeDefined();
    expect(screen.queryByText('Goodboy')).toBeNull();
  });

  it('reports a notification it could not open', async () => {
    state.sessions = [{ id: 'session-1', goal: 'Ship grouping' }];
    state.setCurrentSession.mockRejectedValueOnce(new Error('session gone'));
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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open session' }));
    });

    expect(state.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't open this notification" }),
    );
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

  it('keeps retry visible and reserves the hover slot for dismiss', async () => {
    state.notifications = [
      {
        ...buildNotification({ id: 'n1', title: 'step summary failed', coalesceKey: 'retry' }),
        action: {
          kind: 'retry-step-summary',
          sessionId: 'session-1' as SessionId,
          agentId: 'agent-1' as AgentId,
        },
      },
    ];
    render(<NotificationCenter />);
    await openCenter();

    const slot = screen.getByRole('button', { name: 'Dismiss group' }).closest('span');
    expect(slot?.className).toContain('group-hover:opacity-100');
    expect(slot?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(slot?.contains(screen.getByRole('button', { name: 'Retry' }))).toBe(false);
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
