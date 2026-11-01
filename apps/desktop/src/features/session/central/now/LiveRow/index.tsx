import type { ReactNode } from 'react';
import { FOCUS_RING, ROW_HOVER, TruncatedText, cn } from '@goodboy/ui';
import { ROW_COLUMNS } from '../../rowColumns';

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
      'relative flex min-w-0 items-center rounded-md',
      ROW_COLUMNS.gap,
      ROW_COLUMNS.inset,
      ROW_HOVER,
      isChild ? 'min-h-7' : 'min-h-9 py-1',
    )}
  >
    <button
      type="button"
      aria-label={openLabel}
      data-live-open=""
      onClick={onOpen}
      className={cn('absolute inset-0 cursor-pointer rounded-md', FOCUS_RING)}
    />
    <span
      data-live-lead=""
      className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-2"
    >
      {lane}
      <span className={ROW_COLUMNS.glyph}>{glyph}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-row text-foreground">{kindWord}</span>
          <TruncatedText
            isFocusable
            onClick={onOpen}
            className="pointer-events-auto min-w-0 flex-1 text-ui text-muted-foreground"
          >
            {title === kindWord ? '' : title}
          </TruncatedText>
        </span>
        {reason === null ? null : (
          <TruncatedText
            isFocusable
            onClick={onOpen}
            data-live-reason=""
            className="pointer-events-auto text-meta text-muted-foreground"
          >
            {reason}
          </TruncatedText>
        )}
      </span>
    </span>
    {meter}
    {where === null ? null : (
      <TruncatedText
        isFocusable
        onClick={onOpen}
        data-live-where=""
        className="pointer-events-auto relative min-w-0 shrink basis-48 text-code text-muted-foreground @max-[640px]:hidden"
      >
        {where}
      </TruncatedText>
    )}
    <span className="pointer-events-none relative flex shrink-0 items-center gap-2 [&_button]:pointer-events-auto">
      <span className={cn('flex shrink-0 items-center gap-1', ROW_COLUMNS.status)}>{end}</span>
      <span
        className={cn('flex shrink-0 justify-end whitespace-nowrap tabular-nums', ROW_COLUMNS.time)}
      >
        {time}
      </span>
    </span>
  </div>
);
