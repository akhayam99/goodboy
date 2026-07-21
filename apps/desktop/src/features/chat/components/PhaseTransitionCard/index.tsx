import { useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Markdown, cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { formatStepDuration } from './formatStepDuration';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
};

export const PhaseTransitionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const timestamp = formatCardTime(item.at);
  const hasContext = item.carryForwardContext.trim().length > 0;

  return (
    <div className="border-l-2 border-merged/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-r-md py-1 pl-2 pr-2 text-left motion-safe:transition-colors hover:bg-merged/5"
      >
        <ChevronRight
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-merged/50 motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="shrink-0 text-2xs font-medium uppercase tracking-wide text-merged/80">
          step
        </span>
        {item.degraded === true && (
          <span className="shrink-0 rounded-md bg-warning/15 px-1 py-px text-2xs font-medium text-warning">
            degraded handoff
          </span>
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-foreground/70">
          <span className="truncate">
            {item.fromStep.ordinal + 1}. {item.fromStep.name}
          </span>
          <ArrowRight size={11} aria-hidden className="shrink-0 text-merged/60" />
          <span className="truncate">
            {item.toStep.ordinal + 1}. {item.toStep.name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          {item.durationMs != null && (
            <span>{formatStepDuration({ durationMs: item.durationMs })}</span>
          )}
          <span>{timestamp}</span>
        </span>
      </button>

      {open && hasContext ? (
        <div className="ml-2 flex flex-col gap-1 border-l border-merged/20 py-2 pl-3 pr-2">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            carried forward
          </span>
          <div className="overflow-x-auto text-xs text-foreground/80">
            <Markdown text={item.carryForwardContext} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
