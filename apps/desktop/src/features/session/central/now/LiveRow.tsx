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
  <div data-live-row="" className="flex h-8 min-w-0 items-center gap-2 rounded-md px-1">
    <span className="flex w-4 shrink-0 justify-center">{glyph}</span>
    <button
      type="button"
      aria-label={openLabel}
      onClick={onOpen}
      className={cn(
        'flex min-w-24 flex-1 items-center gap-2 self-stretch rounded-md px-1 text-left',
        ROW_INTERACTIVE,
      )}
    >
      <span className="shrink-0 text-row text-foreground">{kindWord}</span>
      <span className="min-w-0 flex-1 truncate text-ui text-muted-foreground">{title}</span>
    </button>
    {meter}
    <span
      data-live-where=""
      className="min-w-0 shrink basis-48 truncate text-code text-muted-foreground @max-[640px]:hidden"
    >
      {where ?? ''}
    </span>
    <span className="flex w-36 shrink-0 items-center gap-1">{end}</span>
    <span className="flex w-12 shrink-0 justify-end">{time}</span>
  </div>
);
