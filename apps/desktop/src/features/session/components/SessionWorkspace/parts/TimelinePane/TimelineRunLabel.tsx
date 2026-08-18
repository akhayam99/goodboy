import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
};

const titleOf = ({ entry }: Props): string | null => {
  const goal = entry.run.goal?.trim() ?? '';
  if (goal.length === 0 || goal === entry.workflow.name.trim()) {
    return null;
  }
  return goal;
};

export const TimelineRunLabel = ({ entry }: Props) => {
  const title = titleOf({ entry });
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        identity={entry.identity}
      />
      <span className="min-w-0 truncate text-sm leading-5 text-foreground">
        {entry.workflow.name}
      </span>
      {title == null ? null : (
        <span className="min-w-0 truncate text-sm leading-5 text-muted-foreground">{title}</span>
      )}
    </>
  );
};
