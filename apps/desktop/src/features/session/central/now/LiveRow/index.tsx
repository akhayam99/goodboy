import type { ReactNode } from 'react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { LIVE_COLUMNS } from '../liveColumns';

type Props = {
  readonly glyph: ReactNode;
  readonly kindWord: string;
  readonly title: string;
  readonly reason?: string | null;
  readonly openLabel: string;
  readonly onOpen: () => void;
  readonly lane?: ReactNode;
  readonly isChild?: boolean;
  readonly meter?: ReactNode;
  readonly where: string | null;
  readonly end: ReactNode;
  readonly time: ReactNode;
};

export const LiveRow = ({
  glyph,
  kindWord,
  title,
  reason = null,
  openLabel,
  onOpen,
  lane = null,
  isChild = false,
  meter,
  where,
  end,
  time,
}: Props) => (
  <div
    data-live-row=""
    className={cn(
      'relative flex min-w-0 items-center gap-2 rounded-md px-2',
      isChild ? 'min-h-7' : 'min-h-9 py-1',
    )}
  >
    <button
      type="button"
      aria-label={openLabel}
      data-live-open=""
      onClick={onOpen}
      className={cn('absolute inset-0 rounded-md', ROW_INTERACTIVE)}
    />
    <span
      data-live-lead=""
      className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-2"
    >
      {lane}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{glyph}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-row text-foreground">{kindWord}</span>
          <span className="min-w-0 flex-1 truncate text-ui text-muted-foreground">
            {title === kindWord ? '' : title}
          </span>
        </span>
        {reason === null ? null : (
          <span data-live-reason="" className="truncate text-meta text-muted-foreground">
            {reason}
          </span>
        )}
      </span>
    </span>
    {meter}
    {where === null ? null : (
      <span
        data-live-where=""
        className="pointer-events-none relative min-w-0 shrink basis-48 truncate text-code text-muted-foreground @max-[640px]:hidden"
      >
        {where}
      </span>
    )}
    <span className="pointer-events-none relative flex shrink-0 items-center gap-2 [&_button]:pointer-events-auto">
      <span className={cn('flex shrink-0 items-center gap-1', LIVE_COLUMNS.status)}>{end}</span>
      <span
        className={cn(
          'flex shrink-0 justify-end whitespace-nowrap tabular-nums',
          LIVE_COLUMNS.time,
        )}
      >
        {time}
      </span>
    </span>
  </div>
);
