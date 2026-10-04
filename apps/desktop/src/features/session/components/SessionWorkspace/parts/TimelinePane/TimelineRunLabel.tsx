import { WORK_ROW, cn } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import type { GroupSummary } from '../../../../timeline/groupSummary';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { TimelineFoldTitle } from './TimelineFoldTitle';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly summary?: GroupSummary | null;
};

export const TimelineRunLabel = ({ entry, summary = null }: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  const title = entry.run.title ?? entry.workflow.name;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        muted={isDiscarded}
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
    </>
  );
};
