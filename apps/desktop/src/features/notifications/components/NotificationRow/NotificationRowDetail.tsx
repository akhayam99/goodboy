import { useState } from 'react';
import { Bug, SlidersHorizontal } from 'lucide-react';
import type { Notification } from '@goodboy/db';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { openReportSheet } from '../../../bug-report/openReportSheet';
import { RetryWithPicker } from './RetryWithPicker';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
};

const GHOST =
  'inline-flex h-5.5 items-center gap-1 rounded-sm px-2 text-chip text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground';

export const NotificationRowDetail = ({ notifications }: Props) => {
  const now = useNow(30_000);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [latest, ...older] = notifications;
  if (latest == null) {
    return null;
  }
  const retryAction =
    latest.action?.kind === 'retry-summarizer' || latest.action?.kind === 'retry-step-summary'
      ? latest.action
      : null;
  const canReport = latest.severity === 'warning' || latest.severity === 'error';
  const hasBody = latest.body != null && latest.body !== '';
  const hasActions = retryAction != null || canReport;

  return (
    <div className="flex flex-col gap-2 pb-3 pl-13 pr-3">
      {hasBody && (
        <p className="whitespace-pre-wrap break-words text-label text-muted-foreground">
          {latest.body}
        </p>
      )}
      {older.length > 0 && (
        <ul aria-label="Earlier in this group" className="flex flex-col">
          {older.map((entry, index) => (
            <li
              key={entry.id}
              className={cn(
                'relative flex h-5.5 items-center justify-between gap-3 pl-4 text-meta text-muted-foreground',
                'before:absolute before:left-0 before:top-0 before:h-1/2 before:w-2.5 before:rounded-bl-md before:border-b before:border-l before:border-border',
                index < older.length - 1 &&
                  'after:absolute after:left-0 after:top-0 after:h-full after:border-l after:border-border',
              )}
            >
              <span className="truncate">{entry.title}</span>
              <time
                dateTime={entry.ts}
                title={formatDateTime({ at: entry.ts, hasYear: true })}
                className="shrink-0 text-meta text-faint-foreground"
              >
                {formatAge({ from: entry.ts, now })}
              </time>
            </li>
          ))}
        </ul>
      )}
      {hasActions && (
        <div className="-ml-2 flex items-center gap-1">
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
          {canReport && (
            <button
              type="button"
              onClick={() =>
                openReportSheet({ notice: { title: latest.title, body: latest.body ?? '' } })
              }
              className={GHOST}
            >
              <Bug size={ICON_SIZE.row} aria-hidden />
              Report this
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
