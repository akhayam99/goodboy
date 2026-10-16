import type { ReactNode } from 'react';
import { Tooltip } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly glyph: ReactNode;
  readonly word: string;
};

export const SignalWord = ({ label, glyph, word }: Props) => (
  <Tooltip content={label} side="top">
    <span
      role="img"
      aria-label={label}
      data-board-signal=""
      className="inline-flex min-w-0 items-center gap-1 text-meta tabular-nums text-muted-foreground"
    >
      <span aria-hidden className="inline-flex shrink-0 items-center">
        {glyph}
      </span>
      <span aria-hidden className="truncate">
        {word}
      </span>
    </span>
  </Tooltip>
);
