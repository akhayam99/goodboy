import { WORK_ROW, cn } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import type { GroupSummary } from '../../../../timeline/groupSummary';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RevealedRowTag } from './RevealedRowTag';
import { TimelineFoldTitle } from './TimelineFoldTitle';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly summary?: GroupSummary | null;
  readonly isLaneLit?: boolean;
  readonly isRevealed?: boolean;
};

export const TimelineRunLabel = ({
  entry,
  summary = null,
  isLaneLit = false,
  isRevealed = false,
}: Props) => {
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
      {summary === null ? (
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
      ) : (
        <TimelineFoldTitle summary={summary}>
          <span
            title={title}
            className={cn(
              'min-w-24 truncate text-body',
              isDiscarded ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {title}
          </span>
        </TimelineFoldTitle>
      )}
      {isRevealed ? <RevealedRowTag /> : null}
    </>
  );
};
