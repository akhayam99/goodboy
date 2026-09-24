import { Button, InteractiveRow, WORK_META_COLUMN, cn } from '@goodboy/ui';
import type {
  EffortLevel,
  OpenQuestion,
  ProviderId,
  RoleModelPreferences,
  Step,
} from '@goodboy/types';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { TimelineAgentMeta } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineAgentMeta';
import { TimelineRail } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { TimelineRowMarker } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRowMarker';
import { TimelineRowStateLine } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRowStateLine';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { railColumnX, type RailRow } from '../../../workTreeModel/railGeometry';
import type { RowAsk } from '../../../workTreeModel/rowState';
import { TIMELINE_RHYTHM } from '../../../workTreeModel/timelineRhythm';

export type RunTreeRouting = {
  readonly stepById: ReadonlyMap<string, Step>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineAgentEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly routing: RunTreeRouting;
  readonly costUsd: number;
  readonly isNested: boolean;
  readonly parentStepName: string | null;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly onHighlight?: (isOn: boolean) => void;
  readonly onSelect: () => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

type AskParams = {
  readonly ask: RowAsk | null;
};

const answerOf = ({ ask }: AskParams): { readonly question: OpenQuestion | null } | null => {
  if (ask == null) {
    return null;
  }
  switch (ask.kind) {
    case 'answer':
      return { question: ask.question };
    case 'restartStep':
    case 'runStep':
      return null;
    default: {
      const exhaustive: never = ask;
      return exhaustive;
    }
  }
};

export const RunTreeRow = ({
  item,
  entry,
  rail,
  railWidth,
  routing,
  costUsd,
  isNested,
  parentStepName,
  isSelected,
  isHighlighted,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  const { agent } = entry;
  const step =
    !isNested && agent.stepId != null ? (routing.stepById.get(agent.stepId) ?? null) : null;
  const answer = answerOf({ ask: item.rowState.ask });
  const answersFor = isQuestionDelegate({ agent }) ? parentStepName : null;
  const boxHeight = TIMELINE_RHYTHM.grade[item.grade].height;
  const label =
    entry.stepLabel == null
      ? agent.name
      : `${agent.workflowRunId == null ? 'Subagent' : 'Step'} ${entry.stepLabel}, ${agent.name}`;

  return (
    <div
      className="flex min-w-0"
      style={{ height: item.height }}
      data-testid={`run-tree-row-${agent.id}`}
      data-highlighted={isHighlighted}
      onMouseEnter={onHighlight === undefined ? undefined : () => onHighlight(true)}
      onMouseLeave={onHighlight === undefined ? undefined : () => onHighlight(false)}
    >
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
        {rail.markerY == null ? null : (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
            data-rail-column={rail.markerColumn}
          >
            <TimelineRowMarker item={item} />
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 items-end">
        <div className="flex min-w-0 flex-1" style={{ height: boxHeight }}>
          <InteractiveRow
            label={label}
            isSelected={isSelected}
            onOpen={onSelect}
            frameClassName={cn('min-w-0 flex-1', isHighlighted && 'bg-hover text-foreground')}
            className="flex h-full min-w-0 items-center gap-2 pl-2 pr-1.5"
          >
            <span className="w-6 shrink-0 text-right text-3xs tabular-nums text-faint-foreground">
              {entry.stepLabel}
            </span>
            <AgentKindChip kind={entry.agentKind} />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                title={agent.name}
                className={cn(
                  'min-w-0 truncate',
                  isNested ? 'text-xs leading-4' : 'text-sm leading-5',
                  item.rowState.phase === 'queued'
                    ? 'text-muted-foreground'
                    : item.rowState.phase === 'running' || item.hasUnread
                      ? 'font-medium text-foreground'
                      : 'text-foreground',
                )}
              >
                {agent.name}
              </span>
              {answersFor === null ? null : (
                <span className="max-w-40 shrink-0 truncate text-3xs text-muted-foreground">
                  {`answering for ${answersFor}`}
                </span>
              )}
              <TimelineRowStateLine state={item.rowState} />
            </span>
            <TimelineAgentMeta
              agent={agent}
              kind={entry.agentKind}
              step={step}
              roleModels={routing.roleModels}
              sessionProvider={routing.sessionProvider}
              sessionEffort={routing.sessionEffort}
              costUsd={costUsd}
              shouldKeepCost={!isNested}
            />
            <span className={WORK_META_COLUMN.action}>
              {answer === null ? null : (
                <Button
                  variant="warning"
                  emphasis="outline"
                  size="sm"
                  className="h-6 shrink-0"
                  onClick={() => onAnswer(answer.question)}
                >
                  Answer
                </Button>
              )}
            </span>
          </InteractiveRow>
        </div>
      </div>
    </div>
  );
};
