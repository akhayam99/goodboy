import { useEffect, useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { mapNotificationAction } from '../NotificationToastBridge';
import { InboxSkeleton } from './InboxSkeleton';
import { InboxToolbar } from './InboxToolbar';
import { NotificationCard } from './NotificationCard';

type Props = {
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const NotificationsStudio = ({ workspaceName, onClose }: Props) => {
  const notifications = useAppStore((state) => state.notifications);
  const notificationCounts = useAppStore((state) => state.notificationCounts);
  const isLoading = useAppStore((state) => state.notificationsLoading);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markNotificationsRead = useAppStore((state) => state.markNotificationsRead);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const clearNotifications = useAppStore((state) => state.clearNotifications);
  const [isArmed, setIsArmed] = useState(false);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const { total, unread } = notificationCounts;
  const shownNote =
    total > notifications.length ? `, showing the newest ${notifications.length}` : '';
  const subtitle =
    total === 0
      ? 'Everything this workspace reported, in full'
      : `${total} in total, ${unread} unread${shownNote}`;

  return (
    <StudioShell
      icon={CONCEPT_ICONS.notifications}
      tone={CONCEPT_TONE.notifications}
      title="Notifications"
      workspaceName={workspaceName}
      closeLabel="close notifications"
      onClose={onClose}
    >
      {() => (
        <StudioPanel
          title="Inbox"
          subtitle={subtitle}
          maxWidthClass={PANE_RHYTHM.measure.reading}
          action={
            notifications.length > 0 ? (
              <InboxToolbar
                unreadCount={unread}
                isArmed={isArmed}
                onArm={() => setIsArmed(true)}
                onDisarm={() => setIsArmed(false)}
                onMarkAllRead={() => void markNotificationsRead()}
                onDeleteAll={async () => {
                  await clearNotifications();
                  setIsArmed(false);
                }}
              />
            ) : undefined
          }
        >
          {isLoading && notifications.length === 0 ? <InboxSkeleton /> : null}
          {!isLoading && notifications.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.notifications}
              tone={CONCEPT_TONE.notifications}
              title="Nothing to catch up on"
              description="Session milestones, retries, and budget alerts land here as they happen, so you don't have to babysit a running session."
              size="lg"
              headingLevel={2}
            />
          ) : null}
          {notifications.length > 0 && (
            <ul className="flex flex-col gap-3">
              {notifications.map((notification) => {
                const action =
                  notification.action != null
                    ? mapNotificationAction(notification.action, useAppStore.getState())
                    : undefined;
                return (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    actionLabel={action?.label ?? null}
                    onAction={() => action?.onClick()}
                    onMarkRead={() => void markNotificationRead(notification.id)}
                    onDismiss={() => void dismissNotification(notification.id)}
                  />
                );
              })}
            </ul>
          )}
        </StudioPanel>
      )}
    </StudioShell>
  );
};
