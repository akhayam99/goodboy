import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, ICON_SIZE, StatusDot, TruncatedText } from '@goodboy/ui';
import type { TranscriptItem } from '../utils/transcript-items';
import { turnSummary } from '../utils/turnSummary';

import type { OpenTranscriptAt } from '../openTranscriptAt';

type Props = {
  readonly steps: ReadonlyArray<TranscriptItem>;
  readonly turn: number;
  readonly onOpenTranscript?: OpenTranscriptAt;
};

export const TurnSummaryLine = ({ steps, turn, onOpenTranscript }: Props) => {
  const summary = useMemo(() => turnSummary({ steps }), [steps]);
  if (summary === null) {
    return null;
  }
  const errors =
    summary.errorCount === 0 ? null : (
      <span className="flex shrink-0 items-center gap-1 tabular-nums">
        <StatusDot tone="danger" size="sm" />
        {summary.errorCount} {summary.errorCount === 1 ? 'error' : 'errors'}
      </span>
    );

  if (onOpenTranscript === undefined) {
    return (
      <p
        data-turn-steps
        className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground"
      >
        <span className="min-w-0 truncate">{summary.text}</span>
        {errors}
      </p>
    );
  }

  return (
    <div data-turn-steps className="flex min-w-0 flex-col">
      <Button
        variant="quiet"
        size="xs"
        aria-label={summary.title}
        onClick={() => onOpenTranscript({ turn })}
        className="group min-w-0 max-w-full justify-start self-start px-0 font-normal hover:bg-transparent"
      >
        <TruncatedText tooltip={summary.title} className="min-w-0">
          {summary.text}
        </TruncatedText>
        {errors}
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 text-faint-foreground group-hover:text-muted-foreground"
        />
      </Button>
    </div>
  );
};
