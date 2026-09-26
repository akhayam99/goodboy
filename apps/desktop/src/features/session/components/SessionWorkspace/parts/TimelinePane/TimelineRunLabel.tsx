import { WORK_ROW, cn } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RevealedRowTag } from './RevealedRowTag';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly rowState: RowState;
  readonly isLaneLit?: boolean;
  readonly stateNote?: string | null;
  readonly isRevealed?: boolean;
};

export const TimelineRunLabel = ({
  entry,
  rowState,
  isLaneLit = false,
  stateNote = null,
  isRevealed = false,
}: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  const title = entry.run.title ?? entry.workflow.name;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        identity={entry.identity}
        muted={isDiscarded}
        lit={isLaneLit}
      />
      <span
        title={title}
        className={cn(
          'truncate text-sm leading-5',
          WORK_ROW.title,
          isDiscarded ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {title}
      </span>
      <TimelineRowStateLine state={rowState} note={stateNote} />
      {isRevealed ? <RevealedRowTag /> : null}
    </>
  );
};
