import type { ReactNode } from 'react';
import { TruncatedText, cn } from '@goodboy/ui';
import { agentKindPalette } from '../../../session/agent-kind';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { RowPhase } from '../../../workTreeModel/rowState';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly glyph: ReactNode;
  readonly duration: ReactNode;
  readonly phase: RowPhase;
  readonly isNested: boolean;
};

export const RunTreeChecklistCells = ({ entry, glyph, duration, phase, isNested }: Props) => {
  const step =
    entry.stepLabel == null ? '' : isNested ? entry.stepLabel : `Step ${entry.stepLabel}`;
  return (
    <>
      <span
        data-checklist-cell="step"
        className="w-14 shrink-0 truncate text-ui tabular-nums text-muted-foreground"
      >
        {step}
      </span>
      <span data-checklist-cell="role" className="flex w-28 shrink-0 items-center gap-1 text-ui">
        {glyph}
        <span className="min-w-0 truncate text-muted-foreground">
          {agentKindPalette({ kind: entry.agentKind }).label}
        </span>
      </span>
      <TruncatedText
        className={cn(
          'min-w-0 flex-1 truncate',
          isNested ? 'text-ui' : 'text-row',
          phase === 'queued' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {entry.agent.name}
      </TruncatedText>
      <span data-checklist-cell="duration" className="flex shrink-0 justify-end">
        {duration}
      </span>
    </>
  );
};
