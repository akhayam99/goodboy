import { WORK_ROW, cn } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { TimelineRunChip } from './TimelineRunChip';
import type { TimelineRowIdentity } from './timelineRowIdentity';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly identity?: TimelineRowIdentity | null;
  readonly isCardOpen?: boolean;
};

export const TimelineRunLabel = ({ entry, identity = null, isCardOpen = false }: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  const title = entry.run.title ?? entry.workflow.name;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        muted={isDiscarded}
        identity={identity}
        isCardOpen={isCardOpen}
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
    </>
  );
};
