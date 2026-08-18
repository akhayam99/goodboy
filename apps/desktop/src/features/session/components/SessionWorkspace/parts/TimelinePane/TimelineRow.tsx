import type { ReactNode } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Tooltip, cn } from '@goodboy/ui';
import type { TimelineDepth } from '../../../../timeline/flattenTimelineRows';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import { TimelineSpine } from './TimelineSpine';

export type TimelineRowNavigation = {
  readonly label: string;
  readonly onNavigate: () => void;
};

export type TimelineRowContinuation = {
  readonly label: string;
  readonly onContinue: () => void;
};

type Props = {
  readonly timeLabel: string | null;
  readonly indent: TimelineDepth;
  readonly identity: RunIdentity | null;
  readonly marker: ReactNode;
  readonly chip?: ReactNode;
  readonly label: ReactNode;
  readonly meta?: ReactNode;
  readonly navigation: TimelineRowNavigation;
  readonly continuation?: TimelineRowContinuation | null;
  readonly body?: ReactNode;
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
  readonly disclosureLabel?: string;
  readonly needsUser?: boolean;
  readonly onMouseEnter?: () => void;
  readonly onMouseLeave?: () => void;
};

const INDENT: Record<TimelineDepth, string> = {
  0: '',
  1: 'pl-4',
  2: 'pl-8',
};

export const TimelineRow = ({
  timeLabel,
  indent,
  identity,
  marker,
  chip,
  label,
  meta,
  navigation,
  continuation = null,
  body,
  isExpanded = false,
  onToggle,
  disclosureLabel,
  needsUser = false,
  onMouseEnter,
  onMouseLeave,
}: Props) => {
  const canDisclose = onToggle != null;
  const header = (
    <div className="flex min-h-8 min-w-0 flex-1 items-center gap-2 py-1.5 pl-2">
      {chip != null ? <span className="flex shrink-0 items-center">{chip}</span> : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">{label}</div>
      {meta != null ? (
        <span className="shrink-0 text-2xs text-muted-foreground">{meta}</span>
      ) : null}
      {canDisclose ? (
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown size={13} aria-hidden />
          ) : (
            <ChevronRight size={13} aria-hidden />
          )}
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      className="grid grid-cols-[52px_minmax(0,1fr)]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="pr-2 pt-2 text-right text-3xs tabular-nums text-muted-foreground">
        {timeLabel}
      </span>
      <div className={cn('flex min-w-0 items-stretch', INDENT[indent])}>
        <TimelineSpine identity={identity} marker={marker} />
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col rounded-md motion-safe:transition-colors',
            isExpanded && 'bg-muted/40',
            needsUser && !isExpanded && 'bg-warning/5',
          )}
        >
          <div className="flex min-w-0 items-start">
            {canDisclose ? (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={disclosureLabel}
                onClick={onToggle}
                className="flex min-w-0 flex-1 items-center rounded-md text-left motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {header}
              </button>
            ) : (
              header
            )}
            <span className="flex shrink-0 items-center gap-1 py-1.5 pl-2">
              {continuation != null ? (
                <Button variant="ghost" size="sm" onClick={continuation.onContinue}>
                  {continuation.label}
                </Button>
              ) : null}
              <Tooltip content={navigation.label}>
                <button
                  type="button"
                  aria-label={navigation.label}
                  onClick={navigation.onNavigate}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <ArrowRight size={13} aria-hidden />
                </button>
              </Tooltip>
            </span>
          </div>
          {isExpanded && body != null ? (
            <div className="flex flex-col gap-4 px-3 pb-3 pt-1">{body}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
