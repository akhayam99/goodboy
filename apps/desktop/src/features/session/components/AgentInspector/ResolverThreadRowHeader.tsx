import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { ResolverOutcomeChip } from './ResolverOutcomeChip';

type Props = {
  readonly settlement: ResolverThreadSettlement;
  readonly position: number;
  readonly summary: string | null;
  readonly isCollapsible: boolean;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onOpenThread: (() => void) | null;
};

const LABEL_CLASS = 'shrink-0 text-2xs text-muted-foreground/70';

export const ResolverThreadRowHeader = ({
  settlement,
  position,
  summary,
  isCollapsible,
  isExpanded,
  onToggle,
  onOpenThread,
}: Props) => {
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {isCollapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`Thread ${position} details`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:bg-foreground/5"
        >
          <Chevron size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <ResolverOutcomeChip kind={settlement.kind} isClosed={settlement.isClosed} />
          <span className={LABEL_CLASS}>thread {position}</span>
          {summary !== null && summary !== '' && (
            <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/60">
              {summary}
            </span>
          )}
        </button>
      ) : (
        <>
          <ResolverOutcomeChip kind={settlement.kind} isClosed={settlement.isClosed} />
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/70">
            thread {position}
          </span>
        </>
      )}
      {onOpenThread !== null && (
        <button
          type="button"
          onClick={onOpenThread}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          Open on GitHub
          <ArrowRight size={10} aria-hidden className="opacity-70" />
        </button>
      )}
    </div>
  );
};
