import type { ReactNode } from 'react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';

type Props = {
  readonly glyph: ReactNode;
  readonly kindWord: string;
  readonly title: string;
  readonly openLabel: string;
  readonly onOpen: () => void;
  readonly meter?: ReactNode;
  readonly where: string | null;
  readonly end: ReactNode;
  readonly time: ReactNode;
};

export const LiveRow = ({
  glyph,
  kindWord,
  title,
  openLabel,
  onOpen,
  meter,
  where,
  end,
  time,
}: Props) => (
  <div
    data-live-row=""
    className="flex min-h-8 min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-md px-1"
  >
    <span data-live-lead="" className="flex min-w-0 flex-[1_1_14rem] gap-2 self-stretch">
      <span className="flex w-4 shrink-0 items-center justify-center">{glyph}</span>
      <button
        type="button"
        aria-label={openLabel}
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md px-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <span className="shrink-0 text-row text-foreground">{kindWord}</span>
        <span className="line-clamp-2 min-w-0 flex-1 break-words text-ui text-muted-foreground">
          {title === kindWord ? '' : title}
        </span>
      </button>
    </span>
    {meter}
    {where === null ? null : (
      <span
        data-live-where=""
        className="min-w-0 shrink basis-48 truncate text-code text-muted-foreground @max-[640px]:hidden"
      >
        {where}
      </span>
    )}
    <span className="flex shrink-0 items-center gap-2">
      <span className="flex w-36 shrink-0 items-center gap-1">{end}</span>
      <span className="flex w-16 shrink-0 justify-end whitespace-nowrap tabular-nums">{time}</span>
    </span>
  </div>
);
