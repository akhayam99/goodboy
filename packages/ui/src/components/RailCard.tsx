import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../cn';
import { TERMINAL_DIM } from '../terminalDim';
import { FOCUS_RING } from '../focusRing';
import { SELECTED_ROW_CLASSES } from '../selectedRow';

type Props = {
  readonly title: ReactNode;
  readonly status?: ReactNode;
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
  readonly muted?: boolean;
  readonly isSelected?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly onSelect: () => void;
};

export const RailCard = ({
  title,
  status,
  meta,
  trailing,
  muted = false,
  isSelected = false,
  ariaLabel,
  className,
  onSelect,
}: Props) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-current={isSelected ? 'true' : undefined}
    data-selected={isSelected}
    onClick={onSelect}
    className={cn(
      'flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-left motion-safe:transition-colors hover:border-border hover:bg-hover',
      FOCUS_RING,
      SELECTED_ROW_CLASSES,
      muted && ['border-border-soft bg-transparent', TERMINAL_DIM],
      className,
    )}
  >
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="line-clamp-2 text-row text-foreground">{title}</span>
      {status != null ? <span className="flex flex-wrap items-center gap-2">{status}</span> : null}
      {meta}
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {trailing}
      <ChevronRight size={14} aria-hidden className="text-faint-foreground" />
    </span>
  </button>
);
