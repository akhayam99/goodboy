import { useState } from 'react';
import { Markdown, cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptChevron } from '../TranscriptChevron';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { TranscriptShell } from '../TranscriptShell';

const accent = MARKER_ACCENT.primary;

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
};

export const OrchestratorDecisionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <TranscriptShell
        as="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        tone="primary"
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
          orchestrator
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-foreground/70">
          {item.stepName ?? item.action}
        </span>
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
          {formatCardTime(item.at)}
        </span>
      </TranscriptShell>
      {open && (
        <TranscriptShell
          tone="primary"
          variant="leftBorder"
          nested
          className="text-xs text-foreground/80"
        >
          <Markdown text={item.reason} />
        </TranscriptShell>
      )}
    </div>
  );
};
