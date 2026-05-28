// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { NotificationCenter } from './index';

beforeEach(() => {
  state.notifications = [];
  state.loadNotifications = vi.fn(async () => undefined);
  state.markNotificationsRead = vi.fn(async () => undefined);
  state.clearNotifications = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('NotificationCenter', () => {
  it('loads notifications on mount and renders a bell trigger', () => {
    render(<NotificationCenter />);
    expect(state.loadNotifications).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeDefined();
  });

  it('opens the popover and shows the empty state when no notifications', async () => {
    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });
    expect(screen.getByText(/no notifications/i)).toBeDefined();
  });

  it('shows the unread badge when there are unread notifications', () => {
    state.notifications = [
      {
        id: 'n1',
        read: false,
        severity: 'info',
        title: 't',
        body: 'b',
        ts: new Date().toISOString(),
      } as unknown as Notification,
    ];
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /^notifications, 1 unread$/i })).toBeDefined();
  });
});
