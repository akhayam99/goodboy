import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../cn';

type Props = {
  readonly title: ReactNode;
  readonly status?: ReactNode;
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
  readonly muted?: boolean;
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
  ariaLabel,
  className,
  onSelect,
}: Props) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onSelect}
    className={cn(
      'flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated/40 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
      muted && 'opacity-70',
      className,
    )}
  >
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="line-clamp-2 text-sm font-medium text-foreground">{title}</span>
      {status != null ? <span className="flex flex-wrap items-center gap-2">{status}</span> : null}
      {meta}
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {trailing}
      <ChevronRight size={14} aria-hidden className="text-muted-foreground/50" />
    </span>
  </button>
);
