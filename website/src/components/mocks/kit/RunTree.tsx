import './kit.css';
import { AppButton } from './AppButton';
import { AppRow } from './AppRow';
import { GroupLabel } from './GroupLabel';
import { KindChip } from './KindChip';
import { Rail } from './Rail';
import { RoutingCell } from './RoutingCell';
import { WorkMeta } from './WorkMeta';
import { WorkNode } from './WorkNode';
import { cx, nodeIndexOf } from './cx';
import { useIsCoarse } from './useIsCoarse';
import {
  layoutTimelineRail,
  railColumnX,
  type RailGroupInput,
  type RailRowInput,
} from './railGeometry';
import {
  TIMELINE_GAP,
  TIMELINE_GRADE,
  TONE_COLOR,
  markerCenterY,
  reasonSentence,
  reasonShortSentence,
  rowBoxHeight,
  rowStateNodeLabel,
  rowStateNodeState,
  rowStateTone,
  type AgentKind,
  type RowPhase,
  type RowSentenceReason,
  type TimelineGap,
  type TimelineRowGrade,
} from './spec';

export type RunTreeRouting = {
  readonly provider?: Parameters<typeof RoutingCell>[0]['provider'];
  readonly name: string;
  readonly detail?: string;
  readonly isPlanned?: boolean;
};

export type RunTreeRowData = {
  readonly id: string;
  readonly stepLabel?: string;
  readonly kind: AgentKind | 'unknown';
  readonly title: string;
  readonly phase: RowPhase;
  readonly reason?: RowSentenceReason;
  readonly grade?: TimelineRowGrade;
  readonly gap?: TimelineGap;
  readonly isNested?: boolean;
  readonly groupId?: string | null;
  readonly isPending?: boolean;
  readonly routing?: RunTreeRouting;
  readonly time?: string;
  readonly note?: string;
  readonly cost?: string;
  readonly progress?: number | null;
  readonly answersFor?: string;
  readonly hasUnread?: boolean;
  readonly isSelected?: boolean;
  readonly answerLabel?: string;
};

type Props = {
  readonly rows: ReadonlyArray<RunTreeRowData>;
  readonly groups?: ReadonlyArray<RailGroupInput>;
  readonly hasSpine?: boolean;
  readonly heading?: string;
  readonly hasActionColumn?: boolean;
  readonly className?: string;
  readonly label?: string;
};

const STACKED_ROW_HEIGHT = 50;
const STACKED_MARKER_Y = 16;
const NOW_HEIGHT = 24;
const NOW_RULE_Y = 12;
const NO_GROUPS: ReadonlyArray<RailGroupInput> = [];

const gradeOf = (row: RunTreeRowData, isPending: boolean): TimelineRowGrade => {
  if (row.grade !== undefined) {
    return row.grade;
  }
  return isPending ? 'pending' : 'step';
};

const isAnswerable = (row: RunTreeRowData): boolean =>
  row.phase === 'waiting' && row.reason?.kind === 'question';

type StateLineProps = {
  readonly row: RunTreeRowData;
};

const StateLine = ({ row }: StateLineProps) => {
  const { reason } = row;
  if (reason === undefined && row.note !== undefined) {
    return <span className="gkStateLine gkStateNote">{row.note}</span>;
  }
  if (reason === undefined) {
    return null;
  }
  const sentence = reasonSentence(reason);
  const short = reasonShortSentence(reason);
  const tone = rowStateTone({ phase: row.phase, reason });
  return (
    <span
      className="gkStateLine"
      title={sentence}
      data-tone={tone}
      style={tone === 'neutral' ? undefined : { color: TONE_COLOR[tone] }}
    >
      {short === sentence ? (
        sentence
      ) : (
        <>
          <span className="gkStateFull">{sentence}</span>
          <span className="gkStateShort">{short}</span>
        </>
      )}
    </span>
  );
};

type Drafted = {
  readonly row: RunTreeRowData;
  readonly isPending: boolean;
  readonly grade: TimelineRowGrade;
  readonly gap: TimelineGap;
  readonly height: number;
  readonly markerY: number;
};

const NowRow = ({
  heading,
  railWidth,
}: {
  readonly heading: string;
  readonly railWidth: number;
}) => (
  <div className="gkRunRow gkRunNow" style={{ height: NOW_HEIGHT }}>
    <span className="gkRail" style={{ width: railWidth }}>
      <span className="gkNowDot" style={{ left: railColumnX({ column: 0 }), top: NOW_RULE_Y }} />
    </span>
    <GroupLabel label={heading} className="gkNowLabel" />
  </div>
);

export const RunTree = ({
  rows,
  groups = NO_GROUPS,
  hasSpine = false,
  heading,
  hasActionColumn,
  className,
  label,
}: Props) => {
  const isStacked = useIsCoarse();
  const drafted: ReadonlyArray<Drafted> = rows.map((row) => {
    const isPending = row.isPending ?? row.phase === 'queued';
    const grade = gradeOf(row, isPending);
    const gap = row.gap ?? 'none';
    return {
      row,
      isPending,
      grade,
      gap,
      height: isStacked ? TIMELINE_GAP[gap] + STACKED_ROW_HEIGHT : rowBoxHeight({ grade, gap }),
      markerY: isStacked ? TIMELINE_GAP[gap] + STACKED_MARKER_Y : markerCenterY({ grade, gap }),
    };
  });
  const inputs: ReadonlyArray<RailRowInput> = drafted.map((draft) => ({
    id: draft.row.id,
    height: draft.height,
    topY: 0,
    markerY: draft.markerY,
    groupId: draft.row.groupId ?? null,
    isPending: draft.isPending,
  }));
  const layout = layoutTimelineRail({ rows: inputs, groups, hasSpine });
  const hasActions = !isStacked && (hasActionColumn ?? rows.some(isAnswerable));
  return (
    <div
      className={cx('gkRunTree', isStacked && 'gkRunStacked', className)}
      role="list"
      aria-label={label}
    >
      {heading === undefined ? null : <NowRow heading={heading} railWidth={layout.width} />}
      {drafted.map((draft, index) => {
        const { row } = draft;
        const rail = layout.rows[index];
        const state = { phase: row.phase, reason: row.reason };
        const nodeState = rowStateNodeState(state);
        const boxHeight = isStacked ? STACKED_ROW_HEIGHT : TIMELINE_GRADE[draft.grade].height;
        const answer = isAnswerable(row);
        const isNested = row.isNested ?? false;
        const nodeIndex = nodeIndexOf(row.stepLabel);
        const ariaLabel =
          row.stepLabel === undefined
            ? row.title
            : `${isNested ? 'Subagent' : 'Step'} ${row.stepLabel}, ${row.title}`;
        return (
          <div
            key={row.id}
            role="listitem"
            aria-label={ariaLabel}
            className="gkRunRow"
            style={{ height: draft.height }}
            data-row-id={row.id}
            data-phase={row.phase}
            data-has-state={row.reason === undefined && row.note === undefined ? undefined : ''}
          >
            <span className="gkRail" style={{ width: layout.width }}>
              {rail === undefined ? null : <Rail rail={rail} width={layout.width} />}
              {rail?.markerY == null ? null : (
                <span
                  className="gkRailMarker"
                  style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
                  data-rail-column={rail.markerColumn}
                >
                  <WorkNode
                    state={nodeState}
                    label={rowStateNodeLabel(state)}
                    mark={
                      nodeIndex === undefined
                        ? { kind: 'dot' }
                        : { kind: 'index', value: nodeIndex }
                    }
                    progress={row.progress ?? null}
                    hasUnread={row.hasUnread}
                  />
                </span>
              )}
            </span>
            <div className="gkRowBox">
              <div className="gkRowFrame" style={{ height: boxHeight }}>
                <AppRow
                  isSelected={row.isSelected}
                  isWaiting={answer}
                  height={boxHeight}
                  className="gkRunAppRow"
                  innerClassName="gkRunRowInner"
                >
                  <span className="gkOrdinal">{row.stepLabel}</span>
                  <KindChip kind={row.kind} className="gkRowKind" />
                  <span className="gkRowMain">
                    <span
                      title={row.title}
                      className={cx('gkRowTitle', isNested && 'gkRowTitleNested')}
                      data-phase={row.phase}
                      data-emphasis={row.phase === 'running' || row.hasUnread ? '' : undefined}
                    >
                      {row.title}
                    </span>
                    {row.answersFor === undefined ? null : (
                      <span className="gkAnswering">{`answering for ${row.answersFor}`}</span>
                    )}
                    <StateLine row={row} />
                  </span>
                  <WorkMeta
                    isPlanned={row.routing?.isPlanned}
                    routing={
                      row.routing === undefined ? (
                        <span aria-hidden className="gkRouting" />
                      ) : (
                        <RoutingCell {...row.routing} />
                      )
                    }
                    time={row.time ?? ''}
                    cost={row.cost ?? ''}
                  />
                  {hasActions ? (
                    <span className="gkActionColumn">
                      {answer ? <AppButton compact>{row.answerLabel ?? 'Answer'}</AppButton> : null}
                    </span>
                  ) : null}
                </AppRow>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
