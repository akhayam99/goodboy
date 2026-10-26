import type { RefObject } from 'react';
import { Bell } from 'lucide-react';
import { EmptyState, ScrollFade, Skeleton } from '@goodboy/ui';
import type { Notification } from '@goodboy/db';
import { notificationGroupKey } from '../../grouping';
import { openNotificationSession } from '../../openNotificationSession';
import { NotificationRow } from '../NotificationRow';

type Props = {
  readonly isLoading: boolean;
  readonly hasNotifications: boolean;
  readonly groups: ReadonlyArray<ReadonlyArray<Notification>>;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly close: () => void;
  readonly onOpenStudio: () => void;
  readonly onDismiss: (ids: ReadonlyArray<Notification['id']>) => void;
};

export const BellRows = ({
  isLoading,
  hasNotifications,
  groups,
  viewportRef,
  close,
  onOpenStudio,
  onDismiss,
}: Props) => {
  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-3 px-3 py-3"
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
    );
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        size="section"
        className="px-3 py-2"
        icon={Bell}
        title={hasNotifications ? "You're caught up" : 'No notifications yet'}
        description={
          hasNotifications ? 'Everything new has been seen. All shows the history.' : undefined
        }
      />
    );
  }
  return (
    <ScrollFade
      className="max-h-[22rem]"
      viewportClassName="py-1"
      fadeSize={16}
      fadeFrom="elevated"
      viewportRef={viewportRef}
    >
      <ul className="flex flex-col">
        {groups.map((group) => (
          <NotificationRow
            key={notificationGroupKey({ group })}
            scrollKey={notificationGroupKey({ group })}
            notifications={group}
            density="compact"
            isSelected={false}
            onOpen={() => {
              const latest = group[0];
              close();
              if (latest != null && openNotificationSession({ notification: latest })) {
                return;
              }
              onOpenStudio();
            }}
            onActed={close}
            onDismiss={() => onDismiss(group.map((notification) => notification.id))}
          />
        ))}
      </ul>
    </ScrollFade>
  );
};
