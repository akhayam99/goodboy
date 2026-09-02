import { Check, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Notification } from '@goodboy/db';
import { StatusDot, Tooltip, cn } from '@goodboy/ui';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { NOTIFICATION_SEVERITY } from '../../severity';

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
  readonly context: string | null;
  readonly actionLabel: string | null;
  readonly onAction: () => void;
  readonly onMarkRead: () => void;
  readonly onDismiss: () => void;
};

export const NotificationGroupRow = ({
  notifications,
  context,
  actionLabel,
  onAction,
  onMarkRead,
  onDismiss,
}: Props) => {
  const [latest, ...older] = notifications;
  const [isExpanded, setIsExpanded] = useState(false);
  if (latest == null) {
    return null;
  }
  const severity = NOTIFICATION_SEVERITY[latest.severity];
  const isUnread = notifications.some((notification) => notification.read === false);
  const hasBody = latest.body != null && latest.body !== '';
  const border =
    latest.severity === 'error'
      ? 'border-l-danger/40'
      : latest.severity === 'warning'
        ? 'border-l-warning/40'
        : 'border-l-transparent';

  return (
    <li className={cn('group flex flex-col gap-2 border-l-2 px-3 py-3', border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {older.length > 0 ? (
            <Tooltip content={isExpanded ? 'Collapse the group' : 'Expand the group'}>
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                aria-label={isExpanded ? 'Collapse notifications' : 'Expand notifications'}
                aria-expanded={isExpanded}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight
                  size={13}
                  className={cn('transition-transform', isExpanded && 'rotate-90')}
                  aria-hidden
                />
              </button>
            </Tooltip>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              {isUnread ? <StatusDot tone={severity.tone} size="sm" ariaLabel="Unread" /> : null}
              <h3
                className={cn(
                  'truncate text-sm',
                  isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                )}
              >
                {latest.title}
              </h3>
              {notifications.length > 1 ? (
                <span
                  aria-label={`${notifications.length} notifications`}
                  className="rounded-full bg-muted px-1.5 text-3xs tabular-nums text-muted-foreground"
                >
                  {notifications.length}
                </span>
              ) : null}
            </div>
            {hasBody ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {latest.body}
              </p>
            ) : null}
            {context != null ? (
              <span className="truncate text-2xs text-muted-foreground">{context}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <time
            dateTime={latest.ts}
            title={formatAbsoluteDateTime({ iso: latest.ts })}
            className="text-2xs tabular-nums text-muted-foreground"
          >
            {formatRelativeAge({ fromIso: latest.ts })}
          </time>
          <span className="hidden items-center gap-1 group-hover:flex group-focus-within:flex">
            {actionLabel != null ? (
              <button
                type="button"
                onClick={onAction}
                className="rounded px-1.5 py-1 text-2xs hover:bg-muted"
              >
                {actionLabel}
              </button>
            ) : null}
            {isUnread ? (
              <Tooltip content="Mark the group read">
                <button
                  type="button"
                  onClick={onMarkRead}
                  aria-label={`Mark "${latest.title}" group as read`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Check size={12} aria-hidden />
                </button>
              </Tooltip>
            ) : null}
            <Tooltip content="Dismiss the group">
              <button
                type="button"
                onClick={onDismiss}
                aria-label={`Dismiss "${latest.title}" group`}
                className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </Tooltip>
          </span>
        </div>
      </div>
      {isExpanded ? (
        <div className="flex flex-col gap-2 border-l border-border-soft pl-6">
          {older.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 text-muted-foreground"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs font-medium">{entry.title}</span>
                {entry.body != null && entry.body !== '' ? (
                  <span className="whitespace-pre-wrap break-words text-2xs leading-relaxed">
                    {entry.body}
                  </span>
                ) : null}
              </div>
              <time className="shrink-0 text-3xs tabular-nums" dateTime={entry.ts}>
                {formatRelativeAge({ fromIso: entry.ts })}
              </time>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
};
