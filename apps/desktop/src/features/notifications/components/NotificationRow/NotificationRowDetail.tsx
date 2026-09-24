import { useState } from 'react';
import { Send, SlidersHorizontal } from 'lucide-react';
import type { Notification } from '@goodboy/db';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { sendNotificationToDevelopers } from '../../../settings/sendNotificationToDevelopers';
import { RetryWithPicker } from './RetryWithPicker';

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
};

const GHOST =
  'inline-flex h-5.5 items-center gap-1 rounded-sm px-1.5 text-2xs text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground';

export const NotificationRowDetail = ({ notifications }: Props) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [latest, ...older] = notifications;
  if (latest == null) {
    return null;
  }
  const retryAction =
    latest.action?.kind === 'retry-summarizer' || latest.action?.kind === 'retry-step-summary'
      ? latest.action
      : null;
  const canSendToDevelopers = latest.severity === 'warning' || latest.severity === 'error';
  const hasBody = latest.body != null && latest.body !== '';
  const hasActions = retryAction != null || canSendToDevelopers;

  return (
    <div className="flex flex-col gap-2 pb-2.5 pl-9 pr-2.5">
      {hasBody && (
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {latest.body}
        </p>
      )}
      {older.length > 0 && (
        <ul aria-label="Earlier in this group" className="flex flex-col">
          {older.map((entry, index) => (
            <li
              key={entry.id}
              className={cn(
                'relative flex h-5.5 items-center justify-between gap-3 pl-4 text-2xs text-muted-foreground',
                'before:absolute before:left-0 before:top-0 before:h-1/2 before:w-2.5 before:rounded-bl-md before:border-b before:border-l before:border-border',
                index < older.length - 1 &&
                  'after:absolute after:left-0 after:top-0 after:h-full after:border-l after:border-border',
              )}
            >
              <span className="truncate">{entry.title}</span>
              <time
                dateTime={entry.ts}
                title={formatAbsoluteDateTime({ iso: entry.ts })}
                className="shrink-0 text-3xs tabular-nums text-faint-foreground"
              >
                {formatRelativeAge({ fromIso: entry.ts })}
              </time>
            </li>
          ))}
        </ul>
      )}
      {hasActions && (
        <div className="flex items-center gap-1">
          {retryAction != null && (
            <button
              type="button"
              aria-expanded={isPickerOpen}
              onClick={() => setIsPickerOpen((value) => !value)}
              className={GHOST}
            >
              <SlidersHorizontal size={ICON_SIZE.row} aria-hidden />
              Retry with another model
            </button>
          )}
          {canSendToDevelopers && (
            <button
              type="button"
              onClick={() => sendNotificationToDevelopers({ notification: latest })}
              className={GHOST}
            >
              <Send size={ICON_SIZE.row} aria-hidden />
              Send to developers
            </button>
          )}
        </div>
      )}
      {isPickerOpen && retryAction != null && (
        <RetryWithPicker action={retryAction} onDone={() => setIsPickerOpen(false)} />
      )}
    </div>
  );
};
