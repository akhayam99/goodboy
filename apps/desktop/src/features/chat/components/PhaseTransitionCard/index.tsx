import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Markdown, cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { formatStepDuration } from './formatStepDuration';
import { stripWorkflowHandoffHeading } from './stripWorkflowHandoffHeading';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptChevron } from '../TranscriptChevron';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { TranscriptShell } from '../TranscriptShell';

const accent = MARKER_ACCENT.merged;
const warningAccent = MARKER_ACCENT.warning;

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
};

export const PhaseTransitionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const timestamp = formatCardTime(item.at);
  const context = stripWorkflowHandoffHeading({ context: item.carryForwardContext });
  const hasContext = context.trim().length > 0;

  return (
    <div>
      <TranscriptShell
        as="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        tone="merged"
        variant="leftBorder"
        className={cn('flex w-full items-center gap-2 text-left', TRANSCRIPT_ROW_HOVER)}
      >
        <TranscriptChevron open={open} />
        <span
          className={cn(
            'shrink-0 text-2xs font-medium uppercase tracking-wide opacity-80',
            accent.text,
          )}
        >
          step
        </span>
        {item.degraded === true && (
          <span
            className={cn(
              'shrink-0 rounded-md px-1 py-px text-2xs font-medium',
              warningAccent.bg,
              warningAccent.text,
            )}
          >
            degraded handoff
          </span>
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-foreground/70">
          <span className="truncate">
            {item.fromStep.ordinal + 1}. {item.fromStep.name}
          </span>
          <ArrowRight size={11} aria-hidden className={cn('shrink-0 opacity-60', accent.icon)} />
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
      </TranscriptShell>

      {open && hasContext ? (
        <TranscriptShell
          tone="merged"
          variant="leftBorder"
          nested
          className="ml-2 flex flex-col gap-1"
        >
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            carried forward
          </span>
          <div className="overflow-x-auto text-xs text-foreground/80">
            <Markdown text={context} />
          </div>
        </TranscriptShell>
      ) : null}
    </div>
  );
};
