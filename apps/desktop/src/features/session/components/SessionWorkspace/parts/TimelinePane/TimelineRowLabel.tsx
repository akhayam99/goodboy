import type { ReactNode } from 'react';
import { ActivityRow, cn, ICON_SIZE, Tooltip, ValueToken, WORK_ROW } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { MountDiffStat } from '../../../../../../store';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../../../../artifacts/artifactPresentation';
import {
  decisionCountsText,
  segmentsToText,
  sessionEventEmphasis,
  sessionEventProjectRunLabel,
  sessionEventSecondary,
  type TimelineLabelSegment,
} from '../../../../timeline/sessionEventPresentation';
import { timelineEntrySegmentsOf } from './timelineEntrySegmentsOf';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import type { RowStateReason } from '../../../../../workTreeModel/rowState';
import type { TimelineRowGrade } from '../../../../../workTreeModel/timelineRhythm';
import { TimelineRoleGlyph } from './TimelineRoleGlyph';
import type { TimelineRowIdentity } from './timelineRowIdentity';
import { TimelineRowWorktrees } from './TimelineRowWorktrees';
import { TimelineRunLabel } from './TimelineRunLabel';
import { timelineRowTone } from './timelineRowTone';
import { DiffStat } from '../../../../../../shared/components/DiffStat';

type Props = {
  readonly item: TimelineRowItem;
  readonly diffStat?: MountDiffStat | null;
  readonly worktrees?: ReadonlyArray<string>;
  readonly identity?: TimelineRowIdentity | null;
  readonly isCardOpen?: boolean;
  readonly meta?: ReactNode;
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
  if (entry.historyBatch !== undefined) {
    return entry.historyBatch.sub;
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

type LabelEntry = Exclude<TimelineStreamEntry, TimelineRunEntry>;

type EntryParams = {
  readonly entry: LabelEntry;
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
  readonly identity: TimelineRowIdentity | null;
  readonly isCardOpen: boolean;
};

const chipOf = ({ entry, identity, isCardOpen }: ChipParams) => {
  if (entry.kind !== 'agent') {
    return null;
  }
  if (identity !== null && !identity.hasGlyph) {
    return null;
  }
  const glyph = (
    <TimelineRoleGlyph kind={entry.agentKind} identity={identity} isCardOpen={isCardOpen} />
  );
  if (entry.chain == null) {
    return glyph;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 self-center">
      <CONCEPT_ICONS.chain size={ICON_SIZE.mark} aria-hidden className="text-faint-foreground" />
      {glyph}
    </span>
  );
};

type ReasonTitleOfParams = {
  readonly reason: RowStateReason | null;
};

const reasonTitleOf = ({ reason }: ReasonTitleOfParams): string | null => {
  if (reason?.kind === 'review') {
    return reason.runTitle ?? null;
  }
  return reason?.kind === 'job' ? reason.title : null;
};

export const TimelineRowLabel = ({
  item,
  diffStat = null,
  worktrees = NO_WORKTREES,
  identity = null,
  isCardOpen = false,
  meta = null,
}: Props) => {
  const { entry, grade } = item;
  const tone = timelineRowTone({ state: item.rowState });
  if (entry.kind === 'run') {
    return (
      <ActivityRow
        density="feed"
        tone={tone}
        textSize="body"
        text={
          <span className="flex min-w-0 items-center gap-2">
            <TimelineRunLabel entry={entry} identity={identity} isCardOpen={isCardOpen} />
          </span>
        }
        meta={meta}
      />
    );
  }
  const isStep = grade !== 'entry';
  const emphasis =
    entry.kind === 'event' ? sessionEventEmphasis({ kind: entry.event.kind }) : 'plain';
  const head = factHeadOf({ entry, grade });
  const detail = detailOf({ entry, grade });
  const reason = item.rowState.reason;
  const runTitle = entry.kind !== 'agent' ? null : reasonTitleOf({ reason });
  const isMutedJob = reason?.kind === 'job' && reason.isMuted;
  const segments: ReadonlyArray<TimelineLabelSegment> =
    runTitle !== null
      ? [{ kind: 'text', text: runTitle }]
      : head === null
        ? timelineEntrySegmentsOf({ entry })
        : [{ kind: 'text', text: head }];
  const title = titleOf({ entry, segments });
  const isAgent = entry.kind === 'agent';
  const isFact = grade === 'fact';
  const titleNode = (
    <Tooltip content={detail === null ? title : `${title}\n${detail}`}>
      <span
        data-timeline-title=""
        className={cn(
          'flex items-center overflow-hidden',
          isAgent ? cn(WORK_ROW.title, 'flex-1') : 'min-w-0',
          isFact && 'text-meta',
          (emphasis === 'muted' || isFact || isMutedJob) && 'text-muted-foreground',
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
    </Tooltip>
  );
  return (
    <ActivityRow
      density="feed"
      tone={tone}
      textSize={isStep ? 'ui' : 'body'}
      ordinal={item.ordinal == null ? null : <span data-timeline-ordinal="">{item.ordinal}</span>}
      glyph={chipOf({ entry, identity, isCardOpen })}
      text={
        <span className="flex min-w-0 items-center gap-2">
          {titleNode}
          {diffStat == null ? null : (
            <DiffStat additions={diffStat.additions} deletions={diffStat.deletions} />
          )}
          {isAgent && <TimelineRowWorktrees names={worktrees} />}
        </span>
      }
      meta={meta}
    />
  );
};
