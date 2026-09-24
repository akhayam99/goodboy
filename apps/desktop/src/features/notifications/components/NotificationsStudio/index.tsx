import { useEffect, useState } from 'react';
import { EmptyState, Eyebrow, StudioRailLayout } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { mapNotificationAction } from '../NotificationToastBridge';
import {
  NOTIFICATION_DAY_LABEL,
  groupByDay,
  notificationGroupKey,
  sortNotificationGroupsNewestFirst,
} from '../../grouping';
import {
  NO_NOTIFICATION_FILTERS,
  countNotificationFacets,
  filterNotificationGroups,
  notificationMatches,
  type NotificationFilters,
} from '../../facets';
import { useNotificationListKeys } from '../../hooks/useNotificationListKeys';
import { NotificationRow } from '../NotificationRow';
import { NotificationFacetRail } from './NotificationFacetRail';
import { NotificationsSkeleton } from './NotificationsSkeleton';
import { NotificationsToolbar } from './NotificationsToolbar';

type Props = {
  readonly onClose: () => void;
};

const VIEW_TITLE = {
  all: 'All notifications',
  unread: 'Unread notifications',
  action: 'Needs action',
} satisfies Record<NotificationFilters['view'], string>;

type SubtitleParams = {
  readonly total: number;
  readonly unread: number;
};

const subtitle = ({ total, unread }: SubtitleParams): string =>
  total === 0
    ? 'Nothing reported yet'
    : `${total} ${total === 1 ? 'notification' : 'notifications'}, ${unread} unread`;

export const NotificationsStudio = ({ onClose }: Props) => {
  const notifications = useAppStore((state) => state.notifications);
  const buckets = useAppStore((state) => state.notificationCounts);
  const scope = useAppStore((state) => state.notificationScope);
  const hasOlder = useAppStore((state) => state.hasOlderNotifications);
  const isLoading = useAppStore((state) => state.notificationsLoading);
  const workspaceName = useAppStore(
    (state) => state.workspaces.find((ws) => ws.id === state.currentWorkspaceId)?.name ?? null,
  );
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const loadOlderNotifications = useAppStore((state) => state.loadOlderNotifications);
  const setNotificationScope = useAppStore((state) => state.setNotificationScope);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markNotificationsRead = useAppStore((state) => state.markNotificationsRead);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const clearNotifications = useAppStore((state) => state.clearNotifications);
  const [isArmed, setIsArmed] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>(NO_NOTIFICATION_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const groups = sortNotificationGroupsNewestFirst({ notifications });
  const visibleGroups = filterNotificationGroups({ groups, filters });
  const days = groupByDay({ groups: visibleGroups, now: new Date() });
  const orderedGroups = days.flatMap((entry) => entry.groups);
  const visibleKeys = orderedGroups.map((group) => notificationGroupKey({ group }));
  const counts = countNotificationFacets({
    buckets,
    filters,
    isWorkspaceScoped: scope === 'workspace' && workspaceName != null,
  });
  const loadedMatching = notifications.filter((notification) =>
    notificationMatches({ notification, filters }),
  ).length;
  const isFiltered = filters.view !== 'all' || filters.severity != null || filters.source != null;

  const groupByKey = (key: string) =>
    orderedGroups.find((group) => notificationGroupKey({ group }) === key);

  const dismissGroup = (key: string) => {
    const group = groupByKey(key);
    if (group == null) {
      return;
    }
    if (key === selectedKey) {
      const index = visibleKeys.indexOf(key);
      setSelectedKey(visibleKeys[index + 1] ?? visibleKeys[index - 1] ?? null);
    }
    for (const notification of group) {
      void dismissNotification(notification.id);
    }
  };

  const markGroupRead = (key: string) => {
    for (const notification of groupByKey(key) ?? []) {
      if (!notification.read) {
        void markNotificationRead(notification.id);
      }
    }
  };

  const selectGroup = (key: string) => {
    setSelectedKey(key);
    markGroupRead(key);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-notification-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  useNotificationListKeys({
    keys: visibleKeys,
    selectedKey,
    onSelect: selectGroup,
    onDismiss: dismissGroup,
    onActivate: (key) => {
      const action = groupByKey(key)?.[0]?.action;
      if (action == null) {
        return;
      }
      mapNotificationAction(action, useAppStore.getState())?.onClick();
    },
  });

  const clearFilters = () => setFilters(NO_NOTIFICATION_FILTERS);

  return (
    <StudioShell
      icon={CONCEPT_ICONS.notifications}
      tone={CONCEPT_TONE.notifications}
      title="Notifications"
      closeLabel="close notifications"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Notification filters"
          railWidth="narrow"
          rail={
            <NotificationFacetRail
              filters={filters}
              counts={counts}
              scope={scope}
              workspaceName={workspaceName}
              onFiltersChange={setFilters}
              onScopeChange={(next) => {
                setSelectedKey(null);
                void setNotificationScope(next);
              }}
            />
          }
          detail={
            <PaneShell
              scroll="body"
              measure="reading"
              title={VIEW_TITLE[filters.view]}
              description={subtitle({ total: counts.total, unread: counts.unread })}
              actions={
                notifications.length > 0 ? (
                  <NotificationsToolbar
                    unreadCount={counts.unread}
                    isArmed={isArmed}
                    onArm={() => setIsArmed(true)}
                    onDisarm={() => setIsArmed(false)}
                    onMarkAllRead={() => void markNotificationsRead()}
                    onDeleteAll={async () => {
                      await clearNotifications();
                      setIsArmed(false);
                      setSelectedKey(null);
                    }}
                  />
                ) : undefined
              }
            >
              {isLoading && notifications.length === 0 && <NotificationsSkeleton />}
              {!isLoading && notifications.length === 0 && (
                <EmptyState
                  icon={CONCEPT_ICONS.notifications}
                  tone={CONCEPT_TONE.notifications}
                  title="Nothing to catch up on"
                  description="Session milestones, retries and budget alerts land here as they happen."
                  size="lg"
                  headingLevel={2}
                />
              )}
              {notifications.length > 0 && visibleGroups.length === 0 && (
                <EmptyState
                  icon={CONCEPT_ICONS.notifications}
                  tone={CONCEPT_TONE.notifications}
                  title="No notifications match"
                  description={
                    hasOlder
                      ? 'Nothing loaded matches these filters. Older notifications may.'
                      : 'Try another filter or include notifications you have already read.'
                  }
                  action={
                    isFiltered ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-md px-2 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-border hover:bg-hover"
                      >
                        Clear filters
                      </button>
                    ) : undefined
                  }
                  size="lg"
                  headingLevel={2}
                />
              )}
              {days.length > 0 && (
                <div className="flex flex-col gap-4">
                  {days.map((entry) => (
                    <section
                      key={entry.day}
                      aria-label={NOTIFICATION_DAY_LABEL[entry.day]}
                      className="flex flex-col gap-0.5"
                    >
                      <Eyebrow
                        muted
                        className="px-2.5 pb-1"
                        label={
                          <>
                            {NOTIFICATION_DAY_LABEL[entry.day]}{' '}
                            <span className="font-medium tabular-nums">{entry.groups.length}</span>
                          </>
                        }
                      />
                      <ul className="flex flex-col gap-0.5">
                        {entry.groups.map((group) => {
                          const key = notificationGroupKey({ group });
                          return (
                            <NotificationRow
                              key={key}
                              scrollKey={key}
                              notifications={group}
                              density="cozy"
                              isSelected={selectedKey === key}
                              onOpen={() => {
                                if (selectedKey === key) {
                                  setSelectedKey(null);
                                  return;
                                }
                                selectGroup(key);
                              }}
                              onMarkRead={() => markGroupRead(key)}
                              onDismiss={() => dismissGroup(key)}
                            />
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              {hasOlder && notifications.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-2.5 text-2xs text-muted-foreground">
                  <span className="tabular-nums">
                    Showing {loadedMatching} of {counts.matching}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadOlderNotifications()}
                    disabled={isLoading}
                    className="rounded-md px-2 py-1 font-medium text-foreground ring-1 ring-inset ring-border-soft motion-safe:transition-colors hover:bg-hover disabled:opacity-50"
                  >
                    Load older
                  </button>
                </div>
              )}
            </PaneShell>
          }
        />
      )}
    </StudioShell>
  );
};
