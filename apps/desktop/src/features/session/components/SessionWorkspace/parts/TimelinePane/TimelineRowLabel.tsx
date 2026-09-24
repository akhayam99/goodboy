import { ValueToken, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { MountDiffStat } from '../../../../../../store';
import { AgentKindChip } from '../../../AgentKindChip';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import {
  segmentsToText,
  sessionEventEmphasis,
  sessionEventLabel,
  sessionEventProjectRunLabel,
  sessionEventSecondary,
  type TimelineLabelSegment,
} from '../../../../timeline/sessionEventPresentation';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import type { TimelineRowGrade } from '../../../../../workTreeModel/timelineRhythm';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRowWorktrees } from './TimelineRowWorktrees';
import { TimelineRunLabel } from './TimelineRunLabel';
import { DiffStat } from '../../../DiffStat';

type Props = {
  readonly item: TimelineRowItem;
  readonly diffStat?: MountDiffStat | null;
  readonly isLaneLit?: boolean;
  readonly worktrees?: ReadonlyArray<string>;
};

const NO_WORKTREES: ReadonlyArray<string> = [];

type LabelEntry = Exclude<TimelineStreamEntry, TimelineRunEntry>;

type EntryParams = {
  readonly entry: LabelEntry;
};

const segmentsOf = ({ entry }: EntryParams): ReadonlyArray<TimelineLabelSegment> => {
  if (entry.kind === 'agent') {
    return [{ kind: 'text', text: entry.agent.name }];
  }
  if (entry.kind === 'plan') {
    return [{ kind: 'text', text: entry.plan.title }];
  }
  if (entry.kind === 'artifact') {
    return [{ kind: 'text', text: entry.artifact.title }];
  }
  if (entry.kind === 'issue') {
    return [
      { kind: 'value', text: entry.task.identifier, variant: 'issue' },
      { kind: 'text', text: `: ${entry.task.title}` },
    ];
  }
  if (entry.kind === 'branch') {
    const { mountName, branch } = entry.worktree;
    const created: ReadonlyArray<TimelineLabelSegment> = [
      { kind: 'text', text: 'Branch ' },
      { kind: 'value', text: branch, variant: 'branch' },
      { kind: 'text', text: ' created' },
    ];
    if (mountName == null) {
      return created;
    }
    return [
      ...created,
      { kind: 'text', text: ' for ' },
      { kind: 'value', text: mountName, variant: 'project' },
    ];
  }
  if (entry.kind === 'event') {
    const { projectRun } = entry;
    if (projectRun != null) {
      return sessionEventProjectRunLabel({
        mounted: projectRun.mounted,
        detached: projectRun.detached,
      });
    }
    return sessionEventLabel({ event: entry.event });
  }
  const isOpen = entry.questions.every((question) => question.status === 'open');
  const count = entry.questions.length;
  if (isOpen) {
    const first = entry.questions[0];
    if (count === 1 && first != null) {
      return [{ kind: 'text', text: `Question: ${first.text}` }];
    }
    return [{ kind: 'text', text: `${count} questions` }];
  }
  const allDismissed = entry.questions.every((question) => question.status === 'dismissed');
  const allAnswered = entry.questions.every((question) => question.status === 'answered');
  const noun = count === 1 ? 'question' : 'questions';
  const verb = allDismissed ? 'dismissed' : allAnswered ? 'answered' : 'resolved';
  return [{ kind: 'text', text: `${count} ${noun} ${verb}` }];
};

type TitleParams = EntryParams & {
  readonly segments: ReadonlyArray<TimelineLabelSegment>;
};

const titleOf = ({ entry, segments }: TitleParams): string => {
  if (entry.kind === 'event' && entry.projectRun != null) {
    const { mounted, detached } = entry.projectRun;
    return segmentsToText({
      segments: sessionEventProjectRunLabel({
        mounted,
        detached,
        limit: mounted.length + detached.length,
      }),
    });
  }
  return segmentsToText({ segments });
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
  if (!isChained) {
    return <AgentKindChip kind={entry.agentKind} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <CONCEPT_ICONS.chain size={10} aria-hidden className="text-faint-foreground" />
      <AgentKindChip kind={entry.agentKind} />
    </span>
  );
};

export const TimelineRowLabel = ({
  item,
  diffStat = null,
  isLaneLit = false,
  worktrees = NO_WORKTREES,
}: Props) => {
  const { entry, grade } = item;
  if (entry.kind === 'run') {
    return <TimelineRunLabel entry={entry} rowState={item.rowState} isLaneLit={isLaneLit} />;
  }
  const isStep = grade !== 'entry';
  const isQueued = item.rowState.phase === 'queued';
  const emphasis =
    entry.kind === 'event' ? sessionEventEmphasis({ kind: entry.event.kind }) : 'plain';
  const secondary =
    entry.kind === 'event' && entry.projectRun == null
      ? sessionEventSecondary({ event: entry.event })
      : null;
  const segments = segmentsOf({ entry });
  return (
    <>
      {item.ordinal != null ? (
        <span className="w-6 shrink-0 text-right text-3xs tabular-nums text-faint-foreground">
          {item.ordinal}
        </span>
      ) : null}
      {chipOf({ entry, grade })}
      <span
        title={titleOf({ entry, segments })}
        className={cn(
          'flex min-w-0 items-center overflow-hidden',
          isStep ? 'text-xs leading-4' : 'text-sm leading-5',
          emphasis === 'muted' || isQueued
            ? 'text-muted-foreground'
            : item.rowState.phase === 'running' || item.hasUnread
              ? 'font-medium text-foreground'
              : 'text-foreground',
        )}
      >
        {segments.map((segment, index) =>
          segment.kind === 'value' ? (
            <ValueToken key={`${segment.variant}:${index}`} value={segment.text} />
          ) : (
            <span
              key={`text:${index}`}
              className="min-w-0 overflow-hidden text-ellipsis whitespace-pre"
            >
              {segment.text}
            </span>
          ),
        )}
      </span>
      {diffStat == null ? null : (
        <DiffStat additions={diffStat.additions} deletions={diffStat.deletions} />
      )}
      {secondary != null ? (
        <span className="min-w-0 truncate text-2xs text-muted-foreground">{secondary}</span>
      ) : null}
      {entry.kind === 'agent' && <TimelineRowStateLine state={item.rowState} />}
      {entry.kind === 'agent' && <TimelineRowWorktrees names={worktrees} />}
    </>
  );
};
