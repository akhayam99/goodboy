import type { ReactNode } from 'react';
import { Trash2 } from '@goodboy/ui/icons';
import type { Notification } from '@goodboy/db';
import {
  ActivityMeta,
  Button,
  cn,
  CountBadge,
  FOCUS_RING,
  ICON_SIZE,
  IconButton,
  tintClasses,
  Tooltip,
  type ActivityMetaColumn,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { mapNotificationAction, notificationContext } from '../NotificationToastBridge';
import { notificationActionIcon } from '../../actionIcon';
import { isNotificationDebt } from '../../actionClass';
import { markPointersActed } from '../../markPointersActed';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import type { NotificationActionTarget } from '../../../actions/types';
import { NotificationRowActions } from './NotificationRowActions';
import { NotificationRowDetail } from './NotificationRowDetail';
import { NotificationSeverityNode } from './NotificationSeverityNode';
import { NotificationUnreadDot } from './NotificationUnreadDot';
import { useNow } from '../../../../shared/hooks/useNow';

type NotificationRowDensity = 'compact' | 'cozy';

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
  readonly density: NotificationRowDensity;
  readonly isSelected: boolean;
  readonly scrollKey?: string;
  readonly onOpen: () => void;
  readonly onDismiss: () => void;
  readonly onActed?: () => void;
};

const TIME_COLUMN: ReadonlyArray<ActivityMetaColumn> = ['time'];

const ICON_BUTTON = 'flex size-6 items-center justify-center rounded-sm text-muted-foreground';

export const NotificationRow = ({
  notifications,
  density,
  isSelected,
  scrollKey,
  onOpen,
  onDismiss,
  onActed,
}: Props) => {
  const now = useNow(30_000);
  const sessions = useAppStore((state) => state.sessions);
  const workspaces = useAppStore((state) => state.workspaces);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const latest = notifications[0];
  if (latest == null) {
    return null;
  }
  const isUnread = notifications.some((notification) => !notification.read);
  const hasUnreadDebt = notifications.some(
    (notification) => !notification.read && isNotificationDebt({ notification }),
  );
  const action =
    latest.action != null
      ? mapNotificationAction(latest.action, useAppStore.getState(), latest)
      : undefined;
  const otherWorkspaces = workspaces.filter((workspace) => workspace.id !== currentWorkspaceId);
  const context = notificationContext(latest, sessions, otherWorkspaces) ?? null;
  const hasBody = latest.body != null && latest.body !== '';
  const isActed = latest.actedAt !== null;
  const runAction = () => {
    action?.onClick();
    if (action !== undefined) {
      markPointersActed({ notifications });
    }
    onActed?.();
  };
  const actedTag = isActed ? (
    <span data-notification-acted="" className="shrink-0 text-meta text-faint-foreground">
      Opened
    </span>
  ) : null;
  const ageText = formatAge({ from: latest.ts, now });
  const age = (
    <span className="pointer-events-none relative flex justify-end">
      <ActivityMeta
        density="rail"
        columns={TIME_COLUMN}
        time={
          ageText === '' ? null : (
            <Tooltip content={formatDateTime({ at: latest.ts, hasYear: true })}>
              <time dateTime={latest.ts}>{ageText}</time>
            </Tooltip>
          )
        }
      />
    </span>
  );
  const count =
    notifications.length > 1 ? (
      <CountBadge
        count={notifications.length}
        label={`${notifications.length} similar notifications`}
      />
    ) : null;
  const deleteControl = (icon: ReactNode) => (
    <Tooltip content="Delete">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Delete "${latest.title}"`}
        className={cn(ICON_BUTTON, tintClasses('danger').hoverBg, 'hover:text-danger')}
      >
        {icon}
      </button>
    </Tooltip>
  );
  const overlay = (
    <button
      type="button"
      aria-label={latest.title}
      aria-expanded={density === 'cozy' ? isSelected : undefined}
      onClick={onOpen}
      className={cn('absolute inset-0 cursor-pointer rounded-md', FOCUS_RING)}
    />
  );

  if (density === 'compact') {
    const ActionIcon =
      latest.action != null ? notificationActionIcon({ kind: latest.action.kind }) : null;
    return (
      <li
        data-notification-key={scrollKey}
        className="group relative grid grid-cols-[0.875rem_minmax(0,1fr)_auto_3rem] items-center gap-2 rounded-md px-3 py-2 motion-safe:transition-colors hover:bg-hover"
      >
        {overlay}
        <NotificationSeverityNode severity={latest.severity} />
        <span className="pointer-events-none relative flex min-w-0 items-center gap-2">
          {isUnread ? <NotificationUnreadDot isDebt={hasUnreadDebt} /> : null}
          <span
            className={cn(
              'truncate text-meta',
              isUnread ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {latest.title}
          </span>
          {actedTag}
          {count}
        </span>
        {age}
        <span className="relative flex items-center justify-end gap-0.5">
          {action != null && ActionIcon != null && (
            <IconButton icon={ActionIcon} label={action.label} size="xs" onClick={runAction} />
          )}
          <span className="flex">{deleteControl(<Trash2 size={ICON_SIZE.row} aria-hidden />)}</span>
        </span>
      </li>
    );
  }

  const anchorKey = `notification:${scrollKey ?? latest.id}`;
  const target: NotificationActionTarget = {
    kind: 'notification',
    facts: {
      ids: notifications.map((notification) => notification.id),
      unreadIds: notifications
        .filter((notification) => !notification.read)
        .map((notification) => notification.id),
      title: latest.title,
      body: latest.body ?? null,
      severity: latest.severity,
      open: action === undefined ? null : { label: action.label, run: runAction },
    },
  };

  return (
    <li
      data-notification-key={scrollKey}
      data-selected={isSelected}
      className={cn(
        'group/row rounded-md motion-safe:transition-colors',
        isSelected ? 'bg-subtle ring-1 ring-inset ring-border-soft' : 'hover:bg-hover',
      )}
    >
      <ObjectMenuArea target={target} anchorKey={anchorKey}>
        <div className="relative grid grid-cols-[1rem_minmax(0,1fr)_4rem_3.5rem] items-start gap-x-3 px-3 py-2">
          {overlay}
          <NotificationSeverityNode severity={latest.severity} />
          <div className="pointer-events-none relative flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                data-unread={isUnread ? '' : undefined}
                className={cn(
                  'truncate text-ui',
                  isUnread ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {latest.title}
              </h3>
              {isUnread ? <NotificationUnreadDot isDebt={hasUnreadDebt} /> : null}
              {actedTag}
              {count}
            </div>
            {hasBody && !isSelected && (
              <p
                className={cn(
                  'truncate text-meta',
                  isUnread ? 'text-muted-foreground' : 'text-faint-foreground',
                )}
              >
                {latest.body}
              </p>
            )}
            {context != null && (
              <span className="inline-flex min-w-0 items-center gap-1 text-meta text-faint-foreground">
                <CONCEPT_ICONS.sessions size={ICON_SIZE.mark} aria-hidden className="shrink-0" />
                <span className="truncate">{context}</span>
              </span>
            )}
          </div>
          <div className="relative flex h-5 items-center justify-end">{age}</div>
          <NotificationRowActions target={target} anchorKey={anchorKey} />
        </div>
        {isSelected && action != null ? (
          <div data-notification-verbs="" className="flex items-center gap-1 pb-2 pl-10 pr-3">
            <Button variant="secondary" size="xs" onClick={runAction}>
              {action.label}
            </Button>
          </div>
        ) : null}
        {isSelected && <NotificationRowDetail notifications={notifications} />}
      </ObjectMenuArea>
    </li>
  );
};
