// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    notificationsLoading: false,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationRead: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    dismissNotification: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
    retryStepSummary: vi.fn(async () => undefined),
    summarizerStatus: {} as Record<string, unknown>,
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import { NotificationsStudio } from './index';

const LONG_BODY = [
  'the orchestrator could not parse the reply.',
  'it expected a decision marker and found prose instead, so the run stopped here.',
].join('\n');

const buildNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'n1',
    ts: new Date().toISOString(),
    kind: 'error',
    title: 'summarizer failed',
    body: LONG_BODY,
    severity: 'error',
    sessionId: 'session-1',
    workspaceId: 'ws-1',
    read: false,
    action: null,
    ...overrides,
  }) as unknown as Notification;

beforeEach(() => {
  state.notifications = [];
  state.notificationsLoading = false;
  state.loadNotifications = vi.fn(async () => undefined);
  state.markNotificationRead = vi.fn(async () => undefined);
  state.markNotificationsRead = vi.fn(async () => undefined);
  state.dismissNotification = vi.fn(async () => undefined);
  state.clearNotifications = vi.fn(async () => undefined);
  state.retrySummarizer = vi.fn();
  state.summarizerStatus = {};
});

afterEach(cleanup);

const renderStudio = () =>
  render(<NotificationsStudio workspaceName="goodboy" onClose={vi.fn()} />);

describe('NotificationsStudio', () => {
  it('renders the full body of a notification without a clamp', () => {
    state.notifications = [buildNotification()];
    renderStudio();

    const body = screen.getByText(/expected a decision marker and found prose instead/i);
    expect(body.textContent).toBe(LONG_BODY);
    expect(body.className).not.toContain('line-clamp');
    expect(body.className).toContain('whitespace-pre-wrap');
  });

  it('fires the mapped handler behind a notification CTA', async () => {
    state.summarizerStatus = {
      'session-1': { status: 'error', lastAttempt: { turnInput: 'in', turnOutput: 'out' } },
    };
    state.notifications = [
      buildNotification({ action: { kind: 'retry-summarizer', sessionId: 'session-1' } as never }),
    ];
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    });

    expect(state.retrySummarizer).toHaveBeenCalledWith('session-1');
  });

  it('marks only the notification whose row was clicked', async () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'first' }),
      buildNotification({ id: 'n2', title: 'second' }),
    ];
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark "second" as read' }));
    });

    expect(state.markNotificationRead).toHaveBeenCalledTimes(1);
    expect(state.markNotificationRead).toHaveBeenCalledWith('n2');
    expect(state.markNotificationsRead).not.toHaveBeenCalled();
  });

  it('marks every notification read from the toolbar', async () => {
    state.notifications = [buildNotification({ id: 'n1' }), buildNotification({ id: 'n2' })];
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    });

    expect(state.markNotificationsRead).toHaveBeenCalledTimes(1);
    expect(state.markNotificationRead).not.toHaveBeenCalled();
  });

  it('requires the confirm step before deleting every notification', async () => {
    state.notifications = [buildNotification()];
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    });
    expect(state.clearNotifications).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: /delete every notification/i })).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^delete all$/i }));
    });

    expect(state.clearNotifications).toHaveBeenCalledTimes(1);
  });

  it('dismisses a single notification', async () => {
    state.notifications = [buildNotification({ id: 'n7', title: 'only one' })];
    renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss "only one"' }));
    });

    expect(state.dismissNotification).toHaveBeenCalledWith('n7');
  });

  it('separates unread from read on the card surface', () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'unread one', read: false }),
      buildNotification({ id: 'n2', title: 'read one', read: true }),
    ];
    renderStudio();

    const unread = screen.getByText('unread one').closest('li');
    const read = screen.getByText('read one').closest('li');
    expect(unread?.className).toContain('bg-elevated');
    expect(read?.className).not.toContain('bg-elevated');
  });

  it('shows the empty state when there is nothing to catch up on', () => {
    renderStudio();

    expect(screen.getByRole('heading', { name: /nothing to catch up on/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /delete all/i })).toBeNull();
  });
});
