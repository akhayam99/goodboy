// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resolveTaskModel } from '@goodboy/core';
import type { Notification } from '@goodboy/db';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
    retryStepSummary: vi.fn(async () => undefined),
    summarizerStatus: {} as Record<string, unknown>,
    sessions: [] as ReadonlyArray<unknown>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    setCurrentSession: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import { NotificationCenter } from './index';

beforeEach(() => {
  state.notifications = [];
  state.loadNotifications = vi.fn(async () => undefined);
  state.markNotificationsRead = vi.fn(async () => undefined);
  state.clearNotifications = vi.fn(async () => undefined);
  state.retrySummarizer = vi.fn();
  state.retryStepSummary = vi.fn(async () => undefined);
  state.summarizerStatus = {};
  state.sessions = [];
  state.providers = [];
  state.setCurrentSession = vi.fn(async () => undefined);
  state.selectAgent = vi.fn(async () => undefined);
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

  it('opens the popover when the goodboy:open-notifications event is dispatched', async () => {
    render(<NotificationCenter />);
    expect(screen.queryByText(/no notifications/i)).toBeNull();
    await act(async () => {
      window.dispatchEvent(new CustomEvent('goodboy:open-notifications'));
    });
    expect(screen.getByText(/no notifications/i)).toBeDefined();
    expect(state.markNotificationsRead).toHaveBeenCalled();
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

  it('retry with picker dispatches retryStepSummary with the selected override', async () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    state.sessions = [
      {
        id: 'session-1',
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      },
    ];
    state.notifications = [
      {
        id: 'n1',
        read: true,
        severity: 'warning',
        kind: 'summarizer-degraded',
        title: 'step summary degraded',
        body: 'anthropic/haiku: boom',
        ts: new Date().toISOString(),
        sessionId: 'session-1',
        workspaceId: null,
        action: { kind: 'retry-step-summary', sessionId: 'session-1', agentId: 'agent-1' },
      } as unknown as Notification,
    ];

    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry with/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm retry with selected model/i }));
    });

    const expected = resolveTaskModel('summarizer', null, 'anthropic');
    expect(state.retryStepSummary).toHaveBeenCalledWith({
      sessionId: 'session-1',
      agentId: 'agent-1',
      taskModelOverride: expected,
    });
  });

  it('retry with picker dispatches retrySummarizer with the selected override', async () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    state.sessions = [
      {
        id: 'session-2',
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      },
    ];
    state.summarizerStatus = {
      'session-2': { status: 'error', lastAttempt: { turnInput: 'in', turnOutput: 'out' } },
    };
    state.notifications = [
      {
        id: 'n2',
        read: true,
        severity: 'error',
        kind: 'error',
        title: 'summarizer failed',
        body: 'anthropic: boom',
        ts: new Date().toISOString(),
        sessionId: 'session-2',
        workspaceId: null,
        action: { kind: 'retry-summarizer', sessionId: 'session-2' },
      } as unknown as Notification,
    ];

    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry with/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm retry with selected model/i }));
    });

    const expected = resolveTaskModel('summarizer', null, 'anthropic');
    expect(state.retrySummarizer).toHaveBeenCalledWith('session-2', expected);
    expect(screen.queryByRole('button', { name: /confirm retry with selected model/i })).toBeNull();
  });

  it('navigates to the session and agent of a row and closes the panel', async () => {
    state.notifications = [
      {
        id: 'n3',
        read: true,
        severity: 'warning',
        kind: 'summarizer-degraded',
        title: 'step summary degraded',
        body: 'anthropic/haiku: boom',
        ts: new Date().toISOString(),
        sessionId: 'session-3',
        workspaceId: 'ws-1',
        action: { kind: 'retry-step-summary', sessionId: 'session-3', agentId: 'agent-3' },
      } as unknown as Notification,
    ];

    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open step summary degraded/i }));
    });

    expect(state.setCurrentSession).toHaveBeenCalledWith('session-3');
    expect(state.selectAgent).toHaveBeenCalledWith('session-3', 'agent-3');
    expect(screen.queryByText('step summary degraded')).toBeNull();
  });

  it('does not swallow the per-notification action buttons', async () => {
    state.summarizerStatus = {
      'session-4': { status: 'error', lastAttempt: { turnInput: 'in', turnOutput: 'out' } },
    };
    state.notifications = [
      {
        id: 'n4',
        read: true,
        severity: 'error',
        kind: 'error',
        title: 'summarizer failed',
        body: 'anthropic: boom',
        ts: new Date().toISOString(),
        sessionId: 'session-4',
        workspaceId: 'ws-1',
        action: { kind: 'retry-summarizer', sessionId: 'session-4' },
      } as unknown as Notification,
    ];

    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    });

    expect(state.retrySummarizer).toHaveBeenCalledWith('session-4');
    expect(state.setCurrentSession).not.toHaveBeenCalled();
  });

  it('keeps a long notification list inside a bounded scroll viewport', async () => {
    state.notifications = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      read: true,
      severity: 'info',
      title: `title ${i}`,
      body: 'b',
      ts: new Date().toISOString(),
    })) as unknown as ReadonlyArray<Notification>;
    render(<NotificationCenter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });

    const list = screen.getByText('title 0').closest('ul');
    const viewport = list?.parentElement;
    const fadeRoot = viewport?.parentElement;
    expect(viewport?.className).toContain('overflow-y-auto');
    expect(viewport?.className).toContain('max-h-[inherit]');
    expect(fadeRoot?.className).toContain('max-h-80');
  });
});
