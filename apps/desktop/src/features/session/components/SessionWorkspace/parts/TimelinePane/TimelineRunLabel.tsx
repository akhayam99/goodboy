import { cn } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly rowState: RowState;
};

export const TimelineRunLabel = ({ entry, rowState }: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        identity={entry.identity}
        muted={isDiscarded}
      />
      <span
        title={entry.workflow.name}
        className={cn(
          'min-w-24 truncate text-sm leading-5',
          isDiscarded ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {entry.workflow.name}
      </span>
      <TimelineRowStateLine state={rowState} />
    </>
  );
};
