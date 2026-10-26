import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  AnchoredPopover,
  Divider,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  SelectableRow,
  useDropdown,
} from '@goodboy/ui';
import type { Notification } from '@goodboy/db';
import { useAppStore, useAttentionElsewhere } from '../../../../store';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../studioEvent';
import { notificationGroupKey, sortNotificationGroupsNewestFirst } from '../../grouping';
import { isNotificationDebt } from '../../actionClass';
import { BellButton } from './BellButton';
import { BellHeader } from './BellHeader';
import { BellRows } from './BellRows';
import type { PopoverView, ScopeValue } from './bellTypes';
import { useRowsOnScreen } from './useRowsOnScreen';
import { useSeenNotifications } from './useSeenNotifications';

const OPEN_EVENT = 'goodboy:open-notifications';

type ScopeParams = {
  readonly next: ScopeValue;
};

type GroupParams = {
  readonly group: ReadonlyArray<Notification>;
};

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
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const reportError = useAppStore((s) => s.reportError);
  const notificationScope = useAppStore((s) => s.notificationScope);
  const setNotificationScope = useAppStore((s) => s.setNotificationScope);
  const hasManyWorkspaces = useAppStore((s) => s.workspaces.length > 1);
  const elsewhere = useAttentionElsewhere({ currentId: currentWorkspaceId });
  const dismissNotificationGroup = useAppStore((s) => s.dismissNotificationGroup);
  const dropdown = useDropdown({
    align: 'center',
    width: POPOVER_WIDTH_CLASS.wide,
    expectedWidth: POPOVER_WIDTH_PX.wide,
    openEvent: OPEN_EVENT,
  });
  const { open, close, toggle } = dropdown;
  const openRef = useRef(open);
  const viewportRef = useRef<HTMLDivElement | null>(null);
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
    };
    window.addEventListener(OPEN_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpenRequest);
    };
  }, []);

  const handleOpen = () => {
    toggle();
    if (!open) {
      const keys = unreadGroupKeys({ notifications });
      setUnreadKeys(keys);
      setView(keys.size > 0 ? 'unread' : 'all');
    }
  };

  const groups = sortNotificationGroupsNewestFirst({ notifications });
  const unread = groups.filter((group) => group.some((notification) => !notification.read)).length;
  const hasUnreadDebt = notifications.some(
    (notification) => !notification.read && isNotificationDebt({ notification }),
  );
  const shownGroups =
    view === 'unread'
      ? groups.filter((group) => unreadKeys.has(notificationGroupKey({ group })))
      : groups;
  const onScreen = useRowsOnScreen({
    rootRef: viewportRef,
    isActive: open,
    keys: shownGroups.map((group) => notificationGroupKey({ group })),
  });
  const isOnScreen = ({ group }: GroupParams) =>
    onScreen.isEverything || onScreen.keys.has(notificationGroupKey({ group }));
  const lastOnScreenIndex = shownGroups.reduce(
    (last, group, index) => (isOnScreen({ group }) ? index : last),
    -1,
  );
  const unreadBelow =
    lastOnScreenIndex < 0
      ? 0
      : shownGroups
          .slice(lastOnScreenIndex + 1)
          .filter((group) => group.some((notification) => !notification.read)).length;
  const shownUnreadIds = shownGroups
    .filter((group) => isOnScreen({ group }))
    .flatMap((group) =>
      group.filter((notification) => !notification.read).map((notification) => notification.id),
    );
  useSeenNotifications({
    isOpen: open,
    ids: shownUnreadIds,
    onSeen: ({ id }) => {
      markNotificationRead(id).catch((error: unknown) => {
        void reportError({ title: "Couldn't mark the notification read", error });
      });
    },
  });
  const markAllRead = () => {
    markNotificationsRead().catch((error: unknown) => {
      void reportError({ title: "Couldn't mark the notifications read", error });
    });
  };
  const changeScope = ({ next }: ScopeParams) => {
    setNotificationScope(next)
      .then(() => {
        setUnreadKeys(unreadGroupKeys({ notifications: useAppStore.getState().notifications }));
      })
      .catch((error: unknown) => {
        void reportError({ title: "Couldn't change which workspaces the bell shows", error });
      });
  };
  return (
    <div role="region" aria-label="Notifications">
      <AnchoredPopover
        dropdown={dropdown}
        hasBackdrop
        trigger={
          <BellButton
            isOpen={open}
            unread={unread}
            hasUnreadDebt={hasUnreadDebt}
            onClick={handleOpen}
          />
        }
      >
        <BellHeader
          hasNotifications={notifications.length > 0}
          unread={unread}
          view={view}
          onViewChange={setView}
          onMarkAllRead={markAllRead}
          hasManyWorkspaces={hasManyWorkspaces}
          scope={notificationScope}
          elsewhere={elsewhere}
          onScopeChange={(next) => changeScope({ next })}
        />
        <Divider />
        <BellRows
          isLoading={notificationsLoading && notifications.length === 0}
          hasNotifications={notifications.length > 0}
          groups={shownGroups}
          viewportRef={viewportRef}
          close={close}
          onOpenStudio={openNotificationsStudio}
          onDismiss={(ids) => {
            void dismissNotificationGroup({ ids });
          }}
        />
        {unreadBelow > 0 ? (
          <p
            role="status"
            data-unread-below=""
            className="px-3 py-1 text-meta text-muted-foreground"
          >
            {unreadBelow} more unread
          </p>
        ) : null}
        <Divider />
        <SelectableRow
          selected={false}
          onClick={() => {
            close();
            openNotificationsStudio();
          }}
          className="items-center justify-between gap-2 rounded-none px-3 py-2 text-meta"
        >
          Open all notifications
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        </SelectableRow>
      </AnchoredPopover>
    </div>
  );
};
