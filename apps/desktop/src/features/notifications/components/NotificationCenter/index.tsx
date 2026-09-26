import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import {
  AnchoredPopover,
  cn,
  Divider,
  EmptyState,
  SegmentedTabs,
  Skeleton,
  Tooltip,
  useDropdown,
  type SegmentedTabOption,
} from '@goodboy/ui';
import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../../../store';
import { CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../studioEvent';
import { notificationGroupKey, sortNotificationGroupsNewestFirst } from '../../grouping';
import { openNotificationSession } from '../../openNotificationSession';
import { NotificationRow } from '../NotificationRow';

const DROPDOWN_WIDTH = 384;
const MAX_ROWS = 8;
const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 41;
const FOOTER_HEIGHT = 33;
const DROPDOWN_MAX_HEIGHT = HEADER_HEIGHT + MAX_ROWS * ROW_HEIGHT + FOOTER_HEIGHT;
const OPEN_EVENT = 'goodboy:open-notifications';

type PopoverView = 'unread' | 'all';

type UnreadKeysParams = {
  readonly notifications: ReadonlyArray<Notification>;
};

const unreadGroupKeys = ({ notifications }: UnreadKeysParams): ReadonlySet<string> =>
  new Set(
    sortNotificationGroupsNewestFirst({ notifications })
      .filter((group) => group.some((notification) => !notification.read))
      .map((group) => notificationGroupKey({ group })),
  );

const openNotificationsStudio = () => {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_STUDIO_EVENT));
};

export const NotificationCenter = () => {
  const notifications = useAppStore((s) => s.notifications);
  const notificationsLoading = useAppStore((s) => s.notificationsLoading);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);
  const dismissNotification = useAppStore((s) => s.dismissNotification);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const dropdown = useDropdown({
    align: 'center',
    width: 'w-96',
    expectedWidth: DROPDOWN_WIDTH,
    expectedHeight: DROPDOWN_MAX_HEIGHT,
    openEvent: OPEN_EVENT,
    isEscapeEnabled: false,
  });
  const { open, close, toggle } = dropdown;
  const openRef = useRef(open);
  const [unreadKeys, setUnreadKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [view, setView] = useState<PopoverView>('all');

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, currentWorkspaceId]);

  useEffect(() => {
    const handleOpenRequest = () => {
      if (openRef.current) {
        return;
      }
      const keys = unreadGroupKeys({ notifications: useAppStore.getState().notifications });
      setUnreadKeys(keys);
      setView(keys.size > 0 ? 'unread' : 'all');
      void markNotificationsRead();
    };
    window.addEventListener(OPEN_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpenRequest);
    };
  }, [markNotificationsRead]);

  const handleOpen = () => {
    toggle();
    if (!open) {
      const keys = unreadGroupKeys({ notifications });
      setUnreadKeys(keys);
      setView(keys.size > 0 ? 'unread' : 'all');
      void markNotificationsRead();
    }
  };

  const groups = sortNotificationGroupsNewestFirst({ notifications });
  const unread = groups.filter((group) => group.some((notification) => !notification.read)).length;
  const shownGroups = (
    view === 'unread'
      ? groups.filter((group) => unreadKeys.has(notificationGroupKey({ group })))
      : groups
  ).slice(0, MAX_ROWS);
  const viewOptions: ReadonlyArray<SegmentedTabOption<PopoverView>> = [
    {
      value: 'unread',
      label: 'Unread',
      badge: <span className="tabular-nums text-muted-foreground">{unreadKeys.size}</span>,
    },
    { value: 'all', label: 'All' },
  ];

  return (
    <div role="region" aria-label="Notifications" aria-live="polite">
      <AnchoredPopover
        dropdown={dropdown}
        hasBackdrop
        trigger={
          <Tooltip content="notifications" side="top">
            <button
              type="button"
              onClick={handleOpen}
              className={cn(
                'relative flex items-center justify-center rounded-sm p-1.5 motion-safe:transition-colors',
                open
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-hover',
              )}
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            >
              <Bell size={ICON_SIZE.control} aria-hidden />
              {unread > 0 && (
                <span
                  className={cn(
                    'absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-warning px-1 font-semibold leading-none text-on-tone tabular-nums',
                    unread > 9 ? 'text-meta' : 'text-secondary',
                  )}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          </Tooltip>
        }
      >
        <header className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-label font-semibold text-foreground">Notifications</span>
          <SegmentedTabs
            ariaLabel="Show unread or all notifications"
            options={viewOptions}
            value={view}
            onChange={setView}
            size="sm"
          />
        </header>
        <Divider />
        {notificationsLoading && notifications.length === 0 ? (
          <div
            className="flex flex-col gap-3 px-3 py-2.5"
            role="status"
            aria-label="Loading notifications"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <Skeleton className="size-3.5 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-sm" />
              </div>
            ))}
          </div>
        ) : shownGroups.length === 0 ? (
          <EmptyState
            icon={Bell}
            tone={CONCEPT_TONE.notifications}
            title={notifications.length === 0 ? 'No notifications' : 'You are caught up'}
            description={
              notifications.length === 0
                ? 'Run activity and alerts land here.'
                : 'Everything new has been seen. All shows the history.'
            }
            size="inline"
            className="px-3 py-6"
          />
        ) : (
          <ul className="flex flex-col py-1">
            {shownGroups.map((group) => (
              <NotificationRow
                key={notificationGroupKey({ group })}
                notifications={group}
                density="compact"
                isSelected={false}
                onOpen={() => {
                  const latest = group[0];
                  close();
                  if (latest != null && openNotificationSession({ notification: latest })) {
                    return;
                  }
                  openNotificationsStudio();
                }}
                onActed={close}
                onDismiss={() => {
                  for (const notification of group) {
                    void markNotificationRead(notification.id);
                    void dismissNotification(notification.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
        <Divider />
        <button
          type="button"
          onClick={() => {
            close();
            openNotificationsStudio();
          }}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground"
        >
          Open all notifications
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        </button>
      </AnchoredPopover>
    </div>
  );
};
