import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from '@goodboy/ui';

export type TimelineRowDepth = 0 | 1 | 2;

type Props = {
  readonly timeLabel: string | null;
  readonly depth: TimelineRowDepth;
  readonly marker: ReactNode;
  readonly roleChip?: ReactNode;
  readonly label: ReactNode;
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onClick?: () => void;
  readonly onMouseEnter?: () => void;
  readonly onMouseLeave?: () => void;
  readonly ariaLabel?: string;
  readonly isHighlighted?: boolean;
  readonly hasRoleColumn?: boolean;
};

type IndentParams = {
  readonly depth: TimelineRowDepth;
};

const IndentRails = ({ depth }: IndentParams) => {
  if (depth === 0) {
    return null;
  }
  const rails = Array.from({ length: depth }, (_, index) => (
    <span key={index} className="relative w-6 shrink-0">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
    </span>
  ));
  return <>{rails}</>;
};

export const TimelineRow = ({
  timeLabel,
  depth,
  marker,
  roleChip,
  label,
  meta,
  trailing,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ariaLabel,
  isHighlighted = false,
  hasRoleColumn = false,
}: Props) => {
  const isInteractive = onClick != null;
  const activate = () => {
    if (onClick != null) {
      onClick();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };
  const onRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[data-timeline-stop]') != null) {
      return;
    }
    activate();
  };

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onRowClick}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'group/timeline grid min-h-9 grid-cols-[44px_minmax(0,1fr)] rounded-md motion-safe:transition-colors',
        isInteractive &&
          'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
        isHighlighted && 'bg-muted/50',
      )}
    >
      <span className="self-center text-right text-3xs tabular-nums text-muted-foreground">
        {timeLabel}
      </span>
      <div className="flex min-w-0 items-stretch">
        <IndentRails depth={depth} />
        <div className="relative flex w-6 shrink-0 items-center justify-center">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <span className="relative z-10 flex size-4 items-center justify-center bg-canvas">
            {marker}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
          {hasRoleColumn ? (
            <span className="flex w-24 shrink-0 items-center">{roleChip}</span>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-2">{label}</div>
          {meta != null ? <span className="shrink-0">{meta}</span> : null}
          {trailing != null ? (
            <span className="flex shrink-0 items-center gap-1" data-timeline-stop>
              {trailing}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
