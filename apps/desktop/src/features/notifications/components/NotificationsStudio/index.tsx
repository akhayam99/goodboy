import { useEffect, useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { mapNotificationAction } from '../NotificationToastBridge';
import { notificationContext } from '../NotificationToastBridge';
import {
  filterNotificationGroups,
  sortNotificationGroupsNewestFirst,
  type NotificationSeverityFilter,
} from '../../grouping';
import { InboxSkeleton } from './InboxSkeleton';
import { InboxToolbar } from './InboxToolbar';
import { NotificationGroupRow } from './NotificationGroupRow';

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
  const sessions = useAppStore((state) => state.sessions);
  const workspaces = useAppStore((state) => state.workspaces);
  const [isArmed, setIsArmed] = useState(false);
  const [severity, setSeverity] = useState<NotificationSeverityFilter>('all');
  const [isUnreadOnly, setIsUnreadOnly] = useState(false);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const groups = sortNotificationGroupsNewestFirst({ notifications });
  const visibleGroups = filterNotificationGroups({ groups, severity, isUnreadOnly });
  const unread = groups.filter((group) =>
    group.some((notification) => notification.read === false),
  ).length;
  const { total } = notificationCounts;
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
                severity={severity}
                isUnreadOnly={isUnreadOnly}
                isArmed={isArmed}
                onArm={() => setIsArmed(true)}
                onDisarm={() => setIsArmed(false)}
                onMarkAllRead={() => void markNotificationsRead()}
                onDeleteAll={async () => {
                  await clearNotifications();
                  setIsArmed(false);
                }}
                onSeverityChange={setSeverity}
                onUnreadOnlyChange={setIsUnreadOnly}
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
          {notifications.length > 0 && visibleGroups.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.notifications}
              tone={CONCEPT_TONE.notifications}
              title="No notifications match"
              description="Try another severity or include notifications you have already read."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSeverity('all');
                    setIsUnreadOnly(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-border hover:bg-muted"
                >
                  Clear filters
                </button>
              }
              size="lg"
              headingLevel={2}
            />
          ) : null}
          {visibleGroups.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border-soft">
              {visibleGroups.map((group) => {
                const latest = group[0];
                if (latest == null) {
                  return null;
                }
                const action =
                  latest.action != null
                    ? mapNotificationAction(latest.action, useAppStore.getState())
                    : undefined;
                return (
                  <NotificationGroupRow
                    key={latest.coalesceKey ?? latest.id}
                    notifications={group}
                    context={notificationContext(latest, sessions, workspaces) ?? null}
                    actionLabel={action?.label ?? null}
                    onAction={() => action?.onClick()}
                    onMarkRead={() => {
                      for (const notification of group) {
                        void markNotificationRead(notification.id);
                      }
                    }}
                    onDismiss={() => {
                      for (const notification of group) {
                        void dismissNotification(notification.id);
                      }
                    }}
                  />
                );
              })}
            </ul>
          ) : null}
        </StudioPanel>
      )}
    </StudioShell>
  );
};
