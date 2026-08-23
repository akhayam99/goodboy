import { Chip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import {
  sessionEventEmphasis,
  sessionEventSecondary,
  sessionEventTitle,
} from '../../../../timeline/sessionEventPresentation';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import type { TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TimelineRunLabel } from './TimelineRunLabel';

type Props = {
  readonly item: TimelineRowItem;
};

type LabelEntry = Exclude<TimelineStreamEntry, TimelineRunEntry>;

type EntryParams = {
  readonly entry: LabelEntry;
};

const titleOf = ({ entry }: EntryParams): string => {
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
  if (entry.kind === 'event') {
    return sessionEventTitle({ event: entry.event });
  }
  return entry.question.text;
};

type ChipParams = EntryParams & {
  readonly grade: TimelineRowGrade;
};

const chipOf = ({ entry, grade }: ChipParams) => {
  if (entry.kind !== 'agent') {
    return null;
  }
  const isChained = entry.chain != null;
  if (grade !== 'entry' && !isChained) {
    return null;
  }
  const palette = agentKindPalette({ kind: entry.agentKind });
  return (
    <Chip
      tone="neutral"
      label={palette.label}
      icon={isChained ? <CONCEPT_ICONS.chain size={10} aria-hidden /> : null}
      shape="badge"
      size="3xs"
      width="md"
      uppercase
      className={cn('shrink-0', palette.fg)}
    />
  );
};

export const TimelineRowLabel = ({ item }: Props) => {
  const { entry, grade } = item;
  if (entry.kind === 'run') {
    return <TimelineRunLabel entry={entry} />;
  }
  const isStep = grade === 'step';
  const emphasis =
    entry.kind === 'event' ? sessionEventEmphasis({ kind: entry.event.kind }) : 'plain';
  const isPath = entry.kind === 'event' && entry.event.kind === 'worktree_created';
  const secondary = entry.kind === 'event' ? sessionEventSecondary({ event: entry.event }) : null;
  return (
    <>
      {chipOf({ entry, grade })}
      {item.ordinal != null ? (
        <span className="w-4 shrink-0 text-right text-3xs tabular-nums text-muted-foreground/60">
          {item.ordinal}
        </span>
      ) : null}
      {entry.kind === 'answer' ? (
        <span className="shrink-0 text-2xs text-muted-foreground">You answered</span>
      ) : null}
      <span
        className={cn(
          'min-w-0 truncate',
          isStep ? 'text-xs leading-4' : 'text-sm leading-5',
          isPath && 'font-mono text-xs',
          emphasis === 'success'
            ? 'text-success'
            : emphasis === 'muted'
              ? 'text-muted-foreground'
              : item.markerState === 'running' || item.hasUnread
                ? 'font-medium text-foreground'
                : isStep
                  ? 'text-foreground/85'
                  : 'text-foreground',
        )}
      >
        {titleOf({ entry })}
      </span>
      {secondary != null ? (
        <span className="min-w-0 truncate text-2xs text-muted-foreground">{secondary}</span>
      ) : null}
    </>
  );
};
