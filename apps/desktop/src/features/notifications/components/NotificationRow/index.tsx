import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { Notification } from '@goodboy/db';
import {
  Button,
  cn,
  FOCUS_RING,
  ICON_SIZE,
  IconButton,
  StatusDot,
  tintClasses,
  Tooltip,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { mapNotificationAction, notificationContext } from '../NotificationToastBridge';
import { NOTIFICATION_SEVERITY } from '../../severity';
import { notificationActionIcon } from '../../actionIcon';
import { isNotificationDebt } from '../../actionClass';
import { markPointersActed } from '../../markPointersActed';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import type { NotificationActionTarget } from '../../../actions/types';
import { NotificationRowActions } from './NotificationRowActions';
import { NotificationRowDetail } from './NotificationRowDetail';
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
  const severity = NOTIFICATION_SEVERITY[latest.severity];
  const SeverityIcon = severity.icon;
  const isUnread = notifications.some((notification) => !notification.read);
  const hasUnreadDebt = notifications.some(
    (notification) => !notification.read && isNotificationDebt({ notification }),
  );
  const action =
    latest.action != null
      ? mapNotificationAction(latest.action, useAppStore.getState())
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
  const age = (
    <Tooltip content={formatDateTime({ at: latest.ts, hasYear: true })}>
      <time
        dateTime={latest.ts}
        className="pointer-events-none relative text-right text-meta tabular-nums text-faint-foreground"
      >
        {formatAge({ from: latest.ts, now })}
      </time>
    </Tooltip>
  );
  const count =
    notifications.length > 1 ? (
      <span
        aria-label={`${notifications.length} similar notifications`}
        className="shrink-0 rounded-full bg-muted px-2 text-chip text-muted-foreground"
      >
        {notifications.length}
      </span>
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
        <SeverityIcon
          size={ICON_SIZE.control}
          className={cn('pointer-events-none relative shrink-0', tintClasses(severity.tone).icon)}
          aria-label={severity.label}
        />
        <span className="pointer-events-none relative flex min-w-0 items-center gap-2">
          {isUnread ? (
            <span
              data-unread-dot={hasUnreadDebt ? 'warning' : 'primary'}
              role="img"
              aria-label="Unread"
              className="flex shrink-0"
            >
              <StatusDot tone={hasUnreadDebt ? 'warning' : 'primary'} size="sm" />
            </span>
          ) : null}
          <span
            className={cn(
              'truncate text-meta',
              isUnread ? 'font-medium text-foreground' : 'text-muted-foreground',
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
          <SeverityIcon
            size={ICON_SIZE.control}
            className={cn('pointer-events-none relative mt-px', tintClasses(severity.tone).icon)}
            aria-label={severity.label}
          />
          <div className="pointer-events-none relative flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                data-unread={isUnread ? '' : undefined}
                className={cn(
                  'truncate',
                  isUnread ? 'text-row text-foreground' : 'text-meta text-muted-foreground',
                )}
              >
                {latest.title}
              </h3>
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
          <div className="relative flex h-4 items-center justify-end">{age}</div>
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
