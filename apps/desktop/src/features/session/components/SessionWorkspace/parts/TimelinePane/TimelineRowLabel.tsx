import { Chip, cn } from '@goodboy/ui';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { runKindLabel } from '../../../../timeline/runKindLabel';

type Props = {
  readonly item: TimelineRowItem;
};

const titleOf = ({ item }: Props): string => {
  const { entry } = item;
  if (entry.kind === 'run') {
    return entry.workflow.name;
  }
  if (entry.kind === 'agent') {
    return entry.agent.name;
  }
  if (entry.kind === 'plan') {
    return entry.plan.title;
  }
  if (entry.kind === 'issue') {
    return `${entry.task.identifier}: ${entry.task.title}`;
  }
  if (entry.kind === 'branch') {
    return 'Branch created';
  }
  return entry.question.text;
};

const chipOf = ({ item }: Props) => {
  const { entry } = item;
  if (entry.kind === 'run') {
    return (
      <Chip
        tone="accent"
        label={runKindLabel({ workflow: entry.workflow })}
        shape="badge"
        size="3xs"
        width="md"
        className="shrink-0"
      />
    );
  }
  if (entry.kind !== 'agent' || item.grade !== 'entry' || entry.agentKind === 'resolver') {
    return null;
  }
  const palette = agentKindPalette({ kind: entry.agentKind });
  return (
    <Chip
      tone="neutral"
      label={palette.label}
      shape="badge"
      size="3xs"
      width="md"
      uppercase
      className={cn('shrink-0', palette.fg)}
    />
  );
};

export const TimelineRowLabel = ({ item }: Props) => {
  const isStep = item.grade === 'step';
  return (
    <>
      {chipOf({ item })}
      {item.ordinal != null ? (
        <span className="w-4 shrink-0 text-right text-3xs tabular-nums text-muted-foreground/60">
          {item.ordinal}
        </span>
      ) : null}
      {item.entry.kind === 'answer' ? (
        <span className="shrink-0 text-2xs text-muted-foreground">You answered</span>
      ) : null}
      <span
        className={cn(
          'min-w-0 truncate',
          isStep ? 'text-xs leading-4' : 'text-sm leading-5',
          item.markerState === 'running' || item.hasUnread
            ? 'font-medium text-foreground'
            : isStep
              ? 'text-foreground/85'
              : 'text-foreground',
        )}
      >
        {titleOf({ item })}
      </span>
      {item.summary != null ? (
        <span
          className={cn(
            'shrink-0 text-3xs tabular-nums',
            item.markerState === 'failed' ? 'text-danger' : 'text-muted-foreground/70',
          )}
        >
          {item.summary}
        </span>
      ) : null}
    </>
  );
};
