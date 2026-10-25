// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification, NotificationAction } from '@goodboy/db';
import { brandId, type AgentId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEscapeLayer } from '@goodboy/ui';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import {
  installFakeIntersectionObserver,
  type FakeIntersectionObserver,
} from '../../../../__tests__/helpers/fakeIntersectionObserver';

const defaults = vi.hoisted(() => {
  const scope: 'workspace' | 'all' = 'workspace';
  const elsewhere: {
    readonly count: number;
    readonly tone: 'danger' | 'warning' | null;
  } = { count: 0, tone: null };
  return { scope, elsewhere };
});

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    notificationCounts: [],
    notificationsLoading: false,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    markNotificationRead: vi.fn(async (_id: string) => undefined),
    markNotificationsActed: vi.fn(
      async (_params: { readonly ids: ReadonlyArray<string> }) => undefined,
    ),
    clearNotifications: vi.fn(async () => undefined),
    dismissNotificationGroup: vi.fn(async () => undefined),
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
    navigate: vi.fn(),
    setCurrentWorkspace: vi.fn(async () => undefined),
    loadAgentTranscript: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ readonly id: string; readonly name: string }>,
    notificationScope: defaults.scope,
    setNotificationScope: vi.fn(async (_scope: 'workspace' | 'all') => undefined),
    elsewhere: defaults.elsewhere,
  },
}));

vi.mock('../../../../store', async () => {
  const useAppStore = <T,>(selector: (storeState: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return {
    ...(await import('../../../../store/slices/navigation/place')),
    useAppStore,
    useAttentionElsewhere: () => state.elsewhere,
  };
});

import { NotificationCenter } from './index';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../studioEvent';

const MOCK_SESSION = brandId<SessionId>({ value: 'session-1' });
const RETRY_PUBLICATION: NotificationAction = {
  kind: 'retry-publication',
  sessionId: MOCK_SESSION,
};
const OPEN_ACTIVITY: NotificationAction = { kind: 'open-activity', sessionId: MOCK_SESSION };

type BuildNotificationParams = {
  readonly id: string;
  readonly title: string;
  readonly coalesceKey: string;
  readonly read?: boolean;
  readonly sessionId?: string | null;
  readonly ts?: string;
  readonly action?: Notification['action'];
  readonly actedAt?: Notification['actedAt'];
};

const buildNotification = ({
  id,
  title,
  coalesceKey,
  read = false,
  sessionId = null,
  ts = '2026-08-31T12:00:00.000Z',
  action = null,
  actedAt = null,
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
    action,
    actedAt,
  }) as Notification;

const openCenter = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
  });
};

beforeEach(() => {
  state.notifications = [];
  state.notificationCounts = [];
  state.sessions = [];
  state.currentSessionId = null;
  state.loadNotifications.mockClear();
  state.markNotificationsRead.mockClear();
  state.markNotificationRead.mockClear();
  state.markNotificationsActed.mockReset().mockResolvedValue(undefined);
  state.dismissNotificationGroup.mockClear();
  state.navigate.mockClear();
  state.reportError.mockClear();
  state.workspaces = [];
  state.notificationScope = 'workspace';
  state.setNotificationScope.mockReset().mockResolvedValue(undefined);
  state.elsewhere = { count: 0, tone: null };
});

afterEach(cleanup);

describe('NotificationCenter scope', () => {
  const TWO_WORKSPACES = [
    { id: 'ws-1', name: 'Harborline' },
    { id: 'ws-2', name: 'Northwind' },
  ];

  it('has no scope to pick while there is one workspace', async () => {
    state.workspaces = [TWO_WORKSPACES[0]!];
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.queryByRole('tab', { name: /all workspaces/i })).toBeNull();
  });

  it('offers this workspace and all workspaces once there are several', async () => {
    state.workspaces = TWO_WORKSPACES;
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByRole('tab', { name: 'This workspace' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: /all workspaces/i }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('puts the number of sessions that need you elsewhere on the all workspaces tab', async () => {
    state.workspaces = TWO_WORKSPACES;
    state.elsewhere = { count: 3, tone: 'warning' };
    render(<NotificationCenter />);
    await openCenter();

    const tab = screen.getByRole('tab', { name: /all workspaces/i });
    expect(tab.textContent).toContain('3');
  });

  it('shows no number when nothing waits elsewhere', async () => {
    state.workspaces = TWO_WORKSPACES;
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByRole('tab', { name: /all workspaces/i }).textContent).toBe('All workspaces');
  });

  it('widens the bell to every workspace on a click', async () => {
    state.workspaces = TWO_WORKSPACES;
    render(<NotificationCenter />);
    await openCenter();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /all workspaces/i }));
    });

    expect(state.setNotificationScope).toHaveBeenCalledWith('all');
  });

  it('names the failure when the scope cannot change', async () => {
    state.workspaces = TWO_WORKSPACES;
    state.setNotificationScope.mockRejectedValueOnce(new Error('database is locked'));
    render(<NotificationCenter />);
    await openCenter();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /all workspaces/i }));
    });

    expect(state.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't change which workspaces the bell shows" }),
    );
  });
});

describe('NotificationCenter', () => {
  it('names the bell Notifications in its tooltip, capitalised', () => {
    render(<NotificationCenter />);

    expect(tooltipTextOf({ element: screen.getByRole('button', { name: /notifications/i }) })).toBe(
      'Notifications',
    );
  });

  it('renders the specified empty state and marks nothing on open', async () => {
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByText('No notifications yet')).toBeDefined();
    expect(state.markNotificationsRead).not.toHaveBeenCalled();
  });

  it('shows one line and no Unread or All tabs when there is nothing', async () => {
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByText('No notifications yet')).toBeDefined();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'All' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /unread/i })).toBeNull();
  });

  it('keeps the Unread and All tabs once there is something to switch between', async () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'build failed', coalesceKey: 'build', read: true }),
    ];
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByRole('tab', { name: 'All' })).toBeDefined();
    expect(screen.getByRole('tab', { name: /unread/i })).toBeDefined();
  });

  it('closes on escape, and only the bell when a layer sits below it', async () => {
    const closeBelow = vi.fn();
    const offBelow = registerEscapeLayer(closeBelow);
    render(<NotificationCenter />);
    await openCenter();
    expect(screen.getByText('No notifications yet')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByText('No notifications yet')).toBeNull();
    expect(closeBelow).not.toHaveBeenCalled();
    offBelow();
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
    fireEvent.click(screen.getByRole('button', { name: 'Open all notifications' }));

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

  it('draws a 6 px dot on an unread row, warning when a retry waits, and none on a read row', async () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'new one', coalesceKey: 'a' }),
      buildNotification({
        id: 'n2',
        title: 'push failed',
        coalesceKey: 'b',
        action: RETRY_PUBLICATION,
      }),
      buildNotification({ id: 'n3', title: 'seen one', coalesceKey: 'c', read: true }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));

    const rows = screen.getAllByRole('listitem');
    expect(
      rows.map((row) => row.querySelector('[data-unread-dot]')?.getAttribute('data-unread-dot')),
    ).toEqual(['primary', 'warning', undefined]);
  });

  it('opens on the unread tab with the rows that were new', async () => {
    state.notifications = Array.from({ length: 10 }, (_, index) =>
      buildNotification({
        id: `n${index}`,
        title: `row ${index}`,
        coalesceKey: `key-${index}`,
        read: index > 1,
        ts: new Date(Date.UTC(2026, 7, 31, 12, index)).toISOString(),
      }),
    );
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getByRole('tab', { name: /unread/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('scrolls the list instead of cutting it at eight rows', async () => {
    state.notifications = Array.from({ length: 12 }, (_, index) =>
      buildNotification({
        id: `n${index}`,
        title: `row ${index}`,
        coalesceKey: `key-${index}`,
        read: true,
        ts: new Date(Date.UTC(2026, 7, 31, 12, index)).toISOString(),
      }),
    );
    render(<NotificationCenter />);
    await openCenter();

    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    screen.getByText('row 0');
  });

  describe('read means seen', () => {
    let screenObserver: FakeIntersectionObserver;

    beforeEach(() => {
      vi.useFakeTimers();
      screenObserver = installFakeIntersectionObserver();
    });

    afterEach(() => {
      screenObserver.restore();
      vi.useRealTimers();
    });

    const showRows = ({ keys }: { readonly keys: ReadonlyArray<string> }) => {
      screenObserver.show({ attribute: 'data-notification-key', keys });
    };

    const unreadRows = ({ count }: { readonly count: number }) =>
      Array.from({ length: count }, (_, index) =>
        buildNotification({
          id: `n${index}`,
          title: `row ${index}`,
          coalesceKey: `key-${index}`,
          ts: new Date(Date.UTC(2026, 7, 31, 12, index)).toISOString(),
        }),
      );

    it('marks nothing while it opens and each row after one second on screen', async () => {
      state.notifications = unreadRows({ count: 3 });
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['key-0', 'key-1', 'key-2'] });

      expect(state.markNotificationsRead).not.toHaveBeenCalled();
      expect(state.markNotificationRead).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(999);
      });
      expect(state.markNotificationRead).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(state.markNotificationRead.mock.calls.map(([id]) => id).sort()).toEqual([
        'n0',
        'n1',
        'n2',
      ]);
      expect(state.markNotificationsRead).not.toHaveBeenCalled();
    });

    it('leaves a row unread when the bell closes before it was seen', async () => {
      state.notifications = unreadRows({ count: 2 });
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['key-0', 'key-1'] });
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });

      expect(state.markNotificationRead).not.toHaveBeenCalled();
    });

    it('marks only the rows on screen, counts all eleven and says 3 more unread', async () => {
      state.notifications = unreadRows({ count: 11 });
      render(<NotificationCenter />);
      await openCenter();
      const onScreen = Array.from({ length: 8 }, (_, index) => `key-${10 - index}`);
      showRows({ keys: onScreen });
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(11);
      expect(screen.getByRole('tab', { name: /unread/i }).textContent).toContain('11');
      screen.getByText('3 more unread');
      expect(state.markNotificationRead).toHaveBeenCalledTimes(8);
      const marked = state.markNotificationRead.mock.calls.map(([id]) => id);
      expect(marked).not.toContain('n0');
      expect(marked).not.toContain('n1');
      expect(marked).not.toContain('n2');
    });

    it('marks a row that scrolls into view after its own second', async () => {
      state.notifications = unreadRows({ count: 11 });
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['key-10'] });
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      state.markNotificationRead.mockClear();

      showRows({ keys: ['key-10', 'key-0'] });
      await act(async () => {
        vi.advanceTimersByTime(999);
      });
      expect(state.markNotificationRead).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(state.markNotificationRead.mock.calls.map(([id]) => id)).toContain('n0');
    });

    it('does not mark a row that scrolls away before its second', async () => {
      state.notifications = unreadRows({ count: 3 });
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['key-2', 'key-1'] });
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      showRows({ keys: ['key-2'] });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });

      expect(state.markNotificationRead.mock.calls.map(([id]) => id)).toEqual(['n2']);
    });

    it('counts every row as on screen where the window cannot measure them', async () => {
      Reflect.deleteProperty(globalThis, 'IntersectionObserver');
      state.notifications = unreadRows({ count: 3 });
      render(<NotificationCenter />);
      await openCenter();
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });

      expect(state.markNotificationRead).toHaveBeenCalledTimes(3);
    });

    it('marks a coalesced group as one row, every unread entry in it', async () => {
      state.notifications = [
        buildNotification({ id: 'n2', title: 'build failed', coalesceKey: 'build' }),
        buildNotification({ id: 'n1', title: 'build failed', coalesceKey: 'build' }),
      ];
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['build'] });
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });

      expect(state.markNotificationRead.mock.calls.map(([id]) => id).sort()).toEqual(['n1', 'n2']);
    });

    it('offers Mark all read while something is unread and marks every entry on press', async () => {
      state.notifications = unreadRows({ count: 11 });
      render(<NotificationCenter />);
      await openCenter();

      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

      expect(state.markNotificationsRead).toHaveBeenCalledTimes(1);
    });

    it('marks nothing at once when the open request comes from the key', async () => {
      state.notifications = unreadRows({ count: 2 });
      render(<NotificationCenter />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent('goodboy:open-notifications'));
      });

      expect(state.markNotificationsRead).not.toHaveBeenCalled();
      expect(state.markNotificationRead).not.toHaveBeenCalled();
      showRows({ keys: ['key-0', 'key-1'] });
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      expect(state.markNotificationRead).toHaveBeenCalledTimes(2);
    });

    it('says so when a row could not be marked, and does not try it again by itself', async () => {
      state.notifications = unreadRows({ count: 1 });
      state.markNotificationRead.mockRejectedValueOnce(new Error('database is locked'));
      render(<NotificationCenter />);
      await openCenter();
      showRows({ keys: ['key-0'] });

      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      expect(state.markNotificationRead).toHaveBeenCalledTimes(1);
      expect(state.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't mark the notification read" }),
      );
    });

    it('shows no Mark all read when everything was read', async () => {
      state.notifications = [
        buildNotification({ id: 'n1', title: 'old', coalesceKey: 'old', read: true }),
      ];
      render(<NotificationCenter />);
      await openCenter();

      expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
    });
  });

  it('opens the studio from a row with no session to open', async () => {
    state.notifications = [buildNotification({ id: 'n1', title: 'app wide', coalesceKey: 'app' })];
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
    render(<NotificationCenter />);
    await openCenter();

    fireEvent.click(screen.getByRole('button', { name: 'app wide' }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
  });

  it('opens the studio from the footer with no notifications at all', async () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
    render(<NotificationCenter />);
    await openCenter();

    fireEvent.click(screen.getByRole('button', { name: 'Open all notifications' }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, listener);
  });

  it('marks each row with its severity on one line', async () => {
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
    expect(screen.queryByText('Harborline · Ship grouping')).toBeNull();
  });

  it('reports a notification it could not open', async () => {
    state.sessions = [{ id: 'session-1', goal: 'Ship grouping' }];
    state.navigate.mockImplementationOnce(() => {
      throw new Error('session gone');
    });
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

  it('deletes every notification in a group in one call', async () => {
    state.notifications = [
      buildNotification({ id: 'n2', title: 'newest title', coalesceKey: 'shared' }),
      buildNotification({ id: 'n1', title: 'older title', coalesceKey: 'shared' }),
    ];
    render(<NotificationCenter />);
    await openCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Delete "newest title"' }));

    expect(state.dismissNotificationGroup).toHaveBeenCalledTimes(1);
    expect(state.dismissNotificationGroup).toHaveBeenCalledWith({ ids: ['n2', 'n1'] });
  });

  it('keeps retry and delete visible at rest in their own slots', async () => {
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

    const slot = screen
      .getByRole('button', { name: 'Delete "step summary failed"' })
      .closest('span');
    expect(slot?.className).not.toContain('opacity-0');
    expect(slot?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(slot?.contains(screen.getByRole('button', { name: 'Retry' }))).toBe(false);
  });

  describe('pointers and debts', () => {
    const OPEN_BUDGET: NotificationAction = { kind: 'open-budget', sessionId: MOCK_SESSION };

    it('marks a pointer done when its action runs, and closes the popover', async () => {
      state.notifications = [
        buildNotification({
          id: 'n1',
          title: 'near the limit',
          coalesceKey: 'a',
          action: OPEN_BUDGET,
        }),
      ];
      render(<NotificationCenter />);
      await openCenter();

      fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));

      expect(state.markNotificationsActed).toHaveBeenCalledTimes(1);
      expect(state.markNotificationsActed).toHaveBeenCalledWith({ ids: ['n1'] });
    });

    it('marks every entry of a coalesced pointer', async () => {
      state.notifications = [
        buildNotification({
          id: 'n2',
          title: 'near the limit',
          coalesceKey: 'a',
          action: OPEN_BUDGET,
        }),
        buildNotification({
          id: 'n1',
          title: 'near the limit',
          coalesceKey: 'a',
          action: OPEN_BUDGET,
        }),
      ];
      render(<NotificationCenter />);
      await openCenter();

      fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));

      expect(state.markNotificationsActed).toHaveBeenCalledWith({ ids: ['n2', 'n1'] });
    });

    it('leaves a retry waiting when it runs', async () => {
      state.notifications = [
        buildNotification({
          id: 'n1',
          title: 'push failed',
          coalesceKey: 'a',
          action: {
            kind: 'retry-step-summary',
            sessionId: MOCK_SESSION,
            agentId: brandId<AgentId>({ value: 'agent-1' }),
          },
        }),
      ];
      render(<NotificationCenter />);
      await openCenter();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(state.markNotificationsActed).not.toHaveBeenCalled();
    });

    it('says Opened on a pointer that was acted on, and not on one that was not', async () => {
      state.notifications = [
        buildNotification({
          id: 'n2',
          title: 'seen spend',
          coalesceKey: 'a',
          read: true,
          action: OPEN_BUDGET,
          actedAt: isoDateTimeOf({ value: '2026-08-31T12:05:00.000Z' }),
        }),
        buildNotification({ id: 'n1', title: 'new spend', coalesceKey: 'b', action: OPEN_BUDGET }),
      ];
      render(<NotificationCenter />);
      await openCenter();
      fireEvent.click(screen.getByRole('tab', { name: 'All' }));

      const rows = screen.getAllByRole('listitem');
      expect(rows.map((row) => row.querySelector('[data-notification-acted]') !== null)).toEqual([
        true,
        false,
      ]);
    });

    it('does not mark a pointer again once it was opened', async () => {
      state.notifications = [
        buildNotification({
          id: 'n1',
          title: 'near the limit',
          coalesceKey: 'a',
          read: true,
          action: OPEN_BUDGET,
          actedAt: isoDateTimeOf({ value: '2026-08-31T12:05:00.000Z' }),
        }),
      ];
      render(<NotificationCenter />);
      await openCenter();
      fireEvent.click(screen.getByRole('tab', { name: 'All' }));

      fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));

      expect(state.markNotificationsActed).not.toHaveBeenCalled();
    });

    it('names the failure when the pointer could not be marked, and keeps the row', async () => {
      state.notifications = [
        buildNotification({
          id: 'n1',
          title: 'near the limit',
          coalesceKey: 'a',
          action: OPEN_BUDGET,
        }),
      ];
      state.markNotificationsActed.mockRejectedValueOnce(new Error('database is locked'));
      render(<NotificationCenter />);
      await openCenter();

      fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));
      await act(async () => undefined);

      expect(state.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't mark the notification done" }),
      );
      expect(document.querySelector('[data-notification-acted]')).toBeNull();
    });
  });

  it('counts unread groups in the trigger and the unread tab', async () => {
    state.notifications = [
      buildNotification({ id: 'n3', title: 'same group unread', coalesceKey: 'shared' }),
      buildNotification({ id: 'n2', title: 'same group read', coalesceKey: 'shared', read: true }),
      buildNotification({ id: 'n1', title: 'other group', coalesceKey: 'other', read: true }),
    ];
    render(<NotificationCenter />);

    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeDefined();
    await openCenter();
    expect(screen.getByRole('tab', { name: /unread/i }).textContent).toContain('1');
  });

  it('writes the unread count beside the bell dot, capped at 9+', () => {
    state.notifications = Array.from({ length: 4 }, (_, index) =>
      buildNotification({ id: `n${index}`, title: `row ${index}`, coalesceKey: `key-${index}` }),
    );
    const { unmount } = render(<NotificationCenter />);

    expect(document.querySelector('[data-bell-count]')?.textContent).toBe('4');
    unmount();

    state.notifications = Array.from({ length: 11 }, (_, index) =>
      buildNotification({ id: `n${index}`, title: `row ${index}`, coalesceKey: `key-${index}` }),
    );
    render(<NotificationCenter />);

    expect(document.querySelector('[data-bell-count]')?.textContent).toBe('9+');
  });

  it('draws the bell dot amber for an unread retry and blue for an unread link', () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'open it', coalesceKey: 'a', action: OPEN_ACTIVITY }),
    ];
    const { unmount } = render(<NotificationCenter />);

    expect(document.querySelector('[data-bell-dot]')?.getAttribute('data-bell-dot')).toBe('unread');
    unmount();

    state.notifications = [
      buildNotification({
        id: 'n1',
        title: 'push failed',
        coalesceKey: 'a',
        action: RETRY_PUBLICATION,
      }),
    ];
    render(<NotificationCenter />);

    expect(document.querySelector('[data-bell-dot]')?.getAttribute('data-bell-dot')).toBe(
      'warning',
    );
  });

  it('draws no number and no dot once everything was read', () => {
    state.notifications = [
      buildNotification({ id: 'n1', title: 'old', coalesceKey: 'old', read: true }),
    ];
    render(<NotificationCenter />);

    expect(document.querySelector('[data-bell-count]')).toBeNull();
    expect(document.querySelector('[data-bell-dot]')).toBeNull();
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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open session' }));
    });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId }),
    });
  });
});
