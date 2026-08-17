import { Check, Trash2 } from 'lucide-react';
import { Eyebrow, MetaRow, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Notification } from '@goodboy/db';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { NOTIFICATION_SEVERITY } from '../../severity';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { sendNotificationToDevelopers } from '../../../settings/sendNotificationToDevelopers';

type Props = {
  readonly notification: Notification;
  readonly actionLabel: string | null;
  readonly onAction: () => void;
  readonly onMarkRead: () => void;
  readonly onDismiss: () => void;
};

export const NotificationCard = ({
  notification,
  actionLabel,
  onAction,
  onMarkRead,
  onDismiss,
}: Props) => {
  const severity = NOTIFICATION_SEVERITY[notification.severity];
  const SeverityIcon = severity.icon;
  const tint = tintClasses(severity.tone);
  const hasBody = notification.body != null && notification.body !== '';
  const canSendToDevelopers =
    notification.severity === 'warning' || notification.severity === 'error';

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        notification.read ? 'border-border-soft bg-transparent' : 'border-border bg-elevated',
      )}
    >
      <div className="flex items-start gap-3">
        <Eyebrow
          badge
          tone={severity.tone}
          icon={<SeverityIcon size={11} aria-hidden />}
          label={severity.label}
        />
        <MetaRow
          className="ml-auto shrink-0 justify-end"
          items={[
            formatRelativeAge({ fromIso: notification.ts }),
            formatAbsoluteDateTime({ iso: notification.ts }),
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          {!notification.read && <StatusDot tone={severity.tone} size="sm" ariaLabel="Unread" />}
          <h3 className="text-sm font-semibold leading-snug text-foreground">
            {notification.title}
          </h3>
        </div>
        {hasBody && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {notification.body}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actionLabel != null && (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              'rounded-md px-2 py-1 text-2xs font-semibold ring-1 ring-inset motion-safe:transition-colors',
              tint.text,
              tint.ring,
              tint.hoverBg,
            )}
          >
            {actionLabel}
          </button>
        )}
        {canSendToDevelopers ? (
          <button
            type="button"
            onClick={() => sendNotificationToDevelopers({ notification })}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
          >
            <CONCEPT_ICONS.reportIssue size={11} aria-hidden />
            Send to developers
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {!notification.read && (
            <button
              type="button"
              onClick={onMarkRead}
              aria-label={`Mark "${notification.title}" as read`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
            >
              <Check size={11} aria-hidden />
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss "${notification.title}"`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={11} aria-hidden />
            Dismiss
          </button>
        </div>
      </div>
    </li>
  );
};
