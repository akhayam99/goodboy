import type { ReactNode } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import type { Notification } from '@goodboy/db';
import { FOCUS_RING, StatusDot, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { mapNotificationAction, notificationContext } from '../NotificationToastBridge';
import { NOTIFICATION_SEVERITY } from '../../severity';
import { notificationActionIcon } from '../../actionIcon';
import { NotificationRowDetail } from './NotificationRowDetail';

export type NotificationRowDensity = 'compact' | 'cozy';

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
  readonly density: NotificationRowDensity;
  readonly isSelected: boolean;
  readonly scrollKey?: string;
  readonly onOpen: () => void;
  readonly onDismiss: () => void;
  readonly onMarkRead?: () => void;
  readonly onActed?: () => void;
};

const ICON_BUTTON = 'flex size-5.5 items-center justify-center rounded-sm text-muted-foreground';

export const NotificationRow = ({
  notifications,
  density,
  isSelected,
  scrollKey,
  onOpen,
  onDismiss,
  onMarkRead,
  onActed,
}: Props) => {
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
  const action =
    latest.action != null
      ? mapNotificationAction(latest.action, useAppStore.getState())
      : undefined;
  const otherWorkspaces = workspaces.filter((workspace) => workspace.id !== currentWorkspaceId);
  const context = notificationContext(latest, sessions, otherWorkspaces) ?? null;
  const hasBody = latest.body != null && latest.body !== '';
  const runAction = () => {
    action?.onClick();
    onActed?.();
  };
  const age = (
    <time
      dateTime={latest.ts}
      title={formatAbsoluteDateTime({ iso: latest.ts })}
      className="pointer-events-none relative text-right text-3xs tabular-nums text-faint-foreground"
    >
      {formatRelativeAge({ fromIso: latest.ts })}
    </time>
  );
  const count =
    notifications.length > 1 ? (
      <span
        aria-label={`${notifications.length} notifications`}
        className="shrink-0 rounded-full bg-muted px-1.5 text-3xs tabular-nums text-muted-foreground"
      >
        {notifications.length}
      </span>
    ) : null;
  const dismiss = (icon: ReactNode) => (
    <Tooltip content="Dismiss">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss "${latest.title}"`}
        className={cn(ICON_BUTTON, tintClasses('danger').hoverBg, 'hover:text-danger')}
      >
        {icon}
      </button>
    </Tooltip>
  );
  const unreadSlot = (
    <span data-unread-slot className="pointer-events-none relative flex h-4 items-center">
      {isUnread && <StatusDot tone="primary" size="sm" ariaLabel="Unread" />}
    </span>
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
      <li className="group relative grid grid-cols-[0.375rem_0.875rem_minmax(0,1fr)_auto_3rem] items-center gap-2 rounded-md px-3 py-1.5 motion-safe:transition-colors hover:bg-hover">
        {overlay}
        {unreadSlot}
        <SeverityIcon
          size={ICON_SIZE.control}
          className={cn('pointer-events-none relative shrink-0', tintClasses(severity.tone).icon)}
          aria-label={severity.label}
        />
        <span className="pointer-events-none relative flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'truncate text-xs',
              isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {latest.title}
          </span>
          {count}
        </span>
        {age}
        <span className="relative flex items-center justify-end gap-0.5">
          {action != null && ActionIcon != null && (
            <Tooltip content={action.label}>
              <button
                type="button"
                onClick={runAction}
                aria-label={action.label}
                className={cn(ICON_BUTTON, 'hover:bg-hover hover:text-foreground')}
              >
                <ActionIcon size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          )}
          <span className="flex opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {dismiss(<X size={ICON_SIZE.row} aria-hidden />)}
          </span>
        </span>
      </li>
    );
  }

  return (
    <li
      data-notification-key={scrollKey}
      data-selected={isSelected}
      className={cn(
        'group rounded-md motion-safe:transition-colors',
        isSelected ? 'bg-subtle ring-1 ring-inset ring-border-soft' : 'hover:bg-hover',
      )}
    >
      <div className="relative grid grid-cols-[0.375rem_1rem_minmax(0,1fr)_auto_4rem] items-start gap-x-2.5 px-2.5 py-2">
        {overlay}
        {unreadSlot}
        <SeverityIcon
          size={ICON_SIZE.control}
          className={cn('pointer-events-none relative mt-px', tintClasses(severity.tone).icon)}
          aria-label={severity.label}
        />
        <div className="pointer-events-none relative flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3
              className={cn(
                'truncate text-xs',
                isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {latest.title}
            </h3>
            {count}
          </div>
          {hasBody && !isSelected && (
            <p
              className={cn(
                'truncate text-xs',
                isUnread ? 'text-muted-foreground' : 'text-faint-foreground',
              )}
            >
              {latest.body}
            </p>
          )}
          {context != null && (
            <span className="inline-flex min-w-0 items-center gap-1 text-3xs text-faint-foreground">
              <CONCEPT_ICONS.sessions size={10} aria-hidden className="shrink-0" />
              <span className="truncate">{context}</span>
            </span>
          )}
        </div>
        <div className="relative flex h-4 items-center justify-end">
          {action != null && (
            <button
              type="button"
              onClick={runAction}
              className="inline-flex h-5.5 items-center whitespace-nowrap rounded-sm px-2 text-2xs text-foreground ring-1 ring-inset ring-border-soft motion-safe:transition-colors hover:bg-hover"
            >
              {action.label}
            </button>
          )}
        </div>
        <div className="relative flex h-4 items-center justify-end">
          <span
            className={cn(
              'flex motion-safe:transition-opacity group-hover:opacity-0 group-focus-within:opacity-0',
              isSelected && 'opacity-0',
            )}
          >
            {age}
          </span>
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 motion-safe:transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
              isSelected && 'pointer-events-auto opacity-100',
            )}
          >
            {isUnread && onMarkRead != null && (
              <Tooltip content="Mark read">
                <button
                  type="button"
                  onClick={onMarkRead}
                  aria-label={`Mark "${latest.title}" read`}
                  className={cn(ICON_BUTTON, 'hover:bg-hover hover:text-foreground')}
                >
                  <Check size={ICON_SIZE.row} aria-hidden />
                </button>
              </Tooltip>
            )}
            {dismiss(<Trash2 size={ICON_SIZE.row} aria-hidden />)}
          </span>
        </div>
      </div>
      {isSelected && <NotificationRowDetail notifications={notifications} />}
    </li>
  );
};
