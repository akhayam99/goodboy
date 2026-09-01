import { cn } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly isDeciding?: boolean;
};

const titleOf = ({ entry }: { readonly entry: TimelineRunEntry }): string | null => {
  const goal = entry.run.goal?.trim() ?? '';
  if (goal.length === 0 || goal === entry.workflow.name.trim()) {
    return null;
  }
  return goal;
};

export const TimelineRunLabel = ({ entry, isDeciding = false }: Props) => {
  const title = titleOf({ entry });
  const isDiscarded = entry.run.discardedAt != null;
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        identity={entry.identity}
        muted={isDiscarded}
      />
      <span
        className={cn(
          'min-w-0 truncate text-sm leading-5',
          isDiscarded ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {entry.workflow.name}
      </span>
      {title == null ? null : (
        <span className="min-w-0 truncate text-sm leading-5 text-muted-foreground">{title}</span>
      )}
      {isDeciding ? (
        <span className="min-w-0 truncate text-2xs text-muted-foreground">
          {ORCHESTRATOR_DECIDING_SENTENCE}
        </span>
      ) : null}
    </>
  );
};
