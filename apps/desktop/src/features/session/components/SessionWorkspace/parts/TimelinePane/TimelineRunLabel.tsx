import { WORK_ROW, cn } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RevealedRowTag } from './RevealedRowTag';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly isLaneLit?: boolean;
  readonly isRevealed?: boolean;
};

export const TimelineRunLabel = ({ entry, isLaneLit = false, isRevealed = false }: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  const title = entry.run.title ?? entry.workflow.name;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        muted={isDiscarded}
        lit={isLaneLit}
      />
      <span
        title={title}
        className={cn(
          'flex-1 truncate text-body',
          WORK_ROW.title,
          isDiscarded ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {title}
      </span>
      {isRevealed ? <RevealedRowTag /> : null}
    </>
  );
};
