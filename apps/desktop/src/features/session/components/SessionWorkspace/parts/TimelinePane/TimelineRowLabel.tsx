import { ValueToken, WORK_ROW, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { MountDiffStat } from '../../../../../../store';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { agentDisplayName } from '../../../../../../shared/utils/agentDisplayName';
import type {
  TimelineResolveBatchEntry,
  TimelineRunEntry,
  TimelineSubagentGroupEntry,
} from '../../../../timeline/buildTimelineGroups';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../../../../artifacts/artifactPresentation';
import {
  decisionCountsText,
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
import { RevealedRowTag } from './RevealedRowTag';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowWorktrees } from './TimelineRowWorktrees';
import { resolveBatchTitle } from '../../../../timeline/resolveBatchSummary';
import { subagentGroupTitle } from '../../../../timeline/subagentGroups';
import { TimelineGroupLabel } from './TimelineGroupLabel';
import { TimelineFoldTitle } from './TimelineFoldTitle';
import { TimelineRunLabel } from './TimelineRunLabel';
import { DiffStat } from '../../../DiffStat';

type Props = {
  readonly item: TimelineRowItem;
  readonly diffStat?: MountDiffStat | null;
  readonly isLaneLit?: boolean;
  readonly worktrees?: ReadonlyArray<string>;
  readonly isRevealed?: boolean;
  readonly provider?: string | null;
};

type FactParams = {
  readonly entry: LabelEntry;
  readonly grade: TimelineRowGrade;
};

const factHeadOf = ({ entry, grade }: FactParams): string | null => {
  if (grade !== 'fact') {
    return null;
  }
  if (entry.kind === 'plan') {
    return `${ARTIFACT_KIND_MARKER_LABEL.plan} created`;
  }
  if (entry.kind === 'artifact') {
    return `${ARTIFACT_KIND_MARKER_LABEL[entry.artifact.kind]} created`;
  }
  return null;
};

const detailOf = ({ entry, grade }: FactParams): string | null => {
  if (entry.kind === 'plan' && grade === 'fact') {
    return entry.plan.title;
  }
  if (entry.kind === 'artifact' && grade === 'fact') {
    return entry.artifact.title;
  }
  if (entry.kind === 'learning') {
    const { topic, title } = entry.item;
    return topic === null ? title : `${topic} · ${title}`;
  }
  if (entry.kind !== 'event' || entry.projectRun != null) {
    return null;
  }
  if (
    entry.event.kind === 'decisions_changed' &&
    entry.event.payload?.consolidatedAfter === undefined
  ) {
    return decisionCountsText({ payload: entry.event.payload });
  }
  return sessionEventSecondary({ event: entry.event });
};

const NO_WORKTREES: ReadonlyArray<string> = [];

type LabelEntry = Exclude<
  TimelineStreamEntry,
  TimelineRunEntry | TimelineResolveBatchEntry | TimelineSubagentGroupEntry
>;

type EntryParams = {
  readonly entry: LabelEntry;
};

const segmentsOf = ({ entry }: EntryParams): ReadonlyArray<TimelineLabelSegment> => {
  if (entry.kind === 'agent') {
    return [{ kind: 'text', text: agentDisplayName({ name: entry.agent.name }) }];
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
  if (entry.kind === 'learning') {
    return [{ kind: 'text', text: 'Learned' }];
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
    return <AgentKindChip kind={entry.agentKind} className={WORK_ROW.kindChip} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 self-center">
      <CONCEPT_ICONS.chain size={10} aria-hidden className="text-faint-foreground" />
      <AgentKindChip kind={entry.agentKind} className={WORK_ROW.kindChip} />
    </span>
  );
};

export const TimelineRowLabel = ({
  item,
  diffStat = null,
  isLaneLit = false,
  worktrees = NO_WORKTREES,
  isRevealed = false,
  provider = null,
}: Props) => {
  const { entry, grade } = item;
  if (entry.kind === 'run') {
    return (
      <TimelineRunLabel
        entry={entry}
        summary={item.fold?.summary ?? null}
        isLaneLit={isLaneLit}
        isRevealed={isRevealed}
      />
    );
  }
  if (entry.kind === 'resolveBatch') {
    return (
      <TimelineGroupLabel
        title={resolveBatchTitle({ total: entry.summary.total, prNumber: entry.prNumber })}
        summary={entry.summary}
      />
    );
  }
  if (entry.kind === 'subagentGroup') {
    return (
      <TimelineGroupLabel
        title={subagentGroupTitle({ total: entry.summary.total })}
        summary={entry.summary}
      />
    );
  }
  const isStep = grade !== 'entry';
  const isQueued = item.rowState.phase === 'queued';
  const emphasis =
    entry.kind === 'event' ? sessionEventEmphasis({ kind: entry.event.kind }) : 'plain';
  const head = factHeadOf({ entry, grade });
  const detail = detailOf({ entry, grade });
  const segments: ReadonlyArray<TimelineLabelSegment> =
    head === null ? segmentsOf({ entry }) : [{ kind: 'text', text: head }];
  const title = titleOf({ entry, segments });
  const isAgent = entry.kind === 'agent';
  const titleNode = (
    <span
      title={detail === null ? title : `${title} · ${detail}`}
      className={cn(
        'flex items-center overflow-hidden',
        isAgent ? (item.fold === undefined ? cn(WORK_ROW.title, 'flex-1') : 'min-w-24') : 'min-w-0',
        isStep ? 'text-label' : 'text-body',
        emphasis === 'muted' || isQueued || grade === 'fact'
          ? 'text-muted-foreground'
          : item.rowState.phase === 'running' || item.hasUnread
            ? 'font-medium text-foreground'
            : 'text-foreground',
      )}
    >
      {segments.map((segment, index) =>
        segment.kind === 'value' ? (
          <ValueToken
            key={`${segment.variant}:${index}`}
            value={segment.text}
            className={cn(index < segments.length - 1 && 'shrink-0')}
          />
        ) : (
          <span
            key={`text:${index}`}
            className={cn(
              'min-w-0 overflow-hidden text-ellipsis whitespace-pre',
              (index < segments.length - 1 || detail !== null) && 'shrink-0',
            )}
          >
            {segment.text}
          </span>
        ),
      )}
      {detail === null ? null : (
        <>
          <span aria-hidden className="shrink-0 whitespace-pre text-faint-foreground">
            {' · '}
          </span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre text-faint-foreground">
            {detail}
          </span>
        </>
      )}
    </span>
  );
  return (
    <>
      {item.ordinal != null ? (
        <span className="w-6 shrink-0 text-right text-chip text-faint-foreground">
          {item.ordinal}
        </span>
      ) : null}
      {chipOf({ entry, grade })}
      {isAgent ? <TimelineProviderGlyph provider={provider} /> : null}
      {item.fold === undefined ? (
        titleNode
      ) : (
        <TimelineFoldTitle summary={item.fold.summary}>{titleNode}</TimelineFoldTitle>
      )}
      {diffStat == null ? null : (
        <span className="self-center">
          <DiffStat additions={diffStat.additions} deletions={diffStat.deletions} />
        </span>
      )}
      {isAgent && <TimelineRowWorktrees names={worktrees} />}
      {isRevealed ? <RevealedRowTag /> : null}
    </>
  );
};
