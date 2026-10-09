import { SlidersHorizontal } from 'lucide-react';
import {
  Button,
  InteractiveRow,
  Tooltip,
  WORK_META_COLUMN,
  WORK_ROW,
  cn,
  tintClasses,
} from '@goodboy/ui';
import type {
  EffortLevel,
  OpenQuestion,
  PlanWithCount,
  ProviderId,
  RoleModelPreferences,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { KIND_TO_ROLE } from '../../../session/agent-kind';
import {
  guidanceSentTo,
  guidanceTagTip,
} from '../../../../store/slices/workflows/standingGuidance';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { openPlanDrawer } from '../../../plans/openPlanDrawer';
import { AgentStepRow } from '../../../session/components/SessionWorkspace/parts/TimelinePane/AgentStepRow';
import { TimelineRail } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { TimelineRowMarker } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRowMarker';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { railColumnX, type RailRow } from '../../../workTreeModel/railGeometry';
import type { RowAsk } from '../../../workTreeModel/rowState';
import { TIMELINE_RHYTHM } from '../../../workTreeModel/timelineRhythm';
import { RunStepSkip, type RunStepSkipAction } from './RunStepSkip';
import { rowSlotWidth } from './rowSlotWidth';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type RunTreeRouting = {
  readonly stepById: ReadonlyMap<string, Step>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly run?: Pick<WorkflowRun, 'executionMode' | 'rulesSnapshot' | 'orchestrationStop'> | null;
};

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineAgentEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly routing: RunTreeRouting;
  readonly costUsd: number;
  readonly isNested: boolean;
  readonly hasActionColumn: boolean;
  readonly plan: PlanWithCount | null;
  readonly parentStepName: string | null;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly skip: RunStepSkipAction | null;
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
    case 'continue':
    case 'reviewComment':
    case 'groupChild':
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
  hasActionColumn,
  plan,
  parentStepName,
  isSelected,
  isHighlighted,
  skip,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  const { agent } = entry;
  const step =
    !isNested && agent.stepId != null ? (routing.stepById.get(agent.stepId) ?? null) : null;
  const guidance = isNested
    ? null
    : guidanceSentTo({
        run: routing.run,
        role: step?.role ?? KIND_TO_ROLE[entry.agentKind] ?? null,
      });
  const answer = answerOf({ ask: item.rowState.ask });
  const answersFor = isQuestionDelegate({ agent }) ? parentStepName : null;
  const boxHeight = TIMELINE_RHYTHM.grade[item.grade].height;
  const slot = rowSlotWidth({ rail, railWidth, isNested });
  const isSkipShown = answer === null && skip !== null && !isNested && agent.status === 'running';
  const planAction = isNested || answer !== null || isSkipShown ? null : plan;
  const isPlanHeld =
    planAction !== null && planAction.status === 'active' && isRunHeldForPlan({ run: routing.run });
  const label =
    entry.stepLabel == null
      ? agent.name
      : `${agent.workflowRunId == null ? 'Subagent' : 'Step'} ${entry.stepLabel}, ${agent.name}`;

  return (
    <AgentStepRow
      item={item}
      entry={entry}
      step={step}
      roleModels={routing.roleModels}
      sessionProvider={routing.sessionProvider}
      sessionEffort={routing.sessionEffort}
      costUsd={costUsd}
      onOpen={onSelect}
    >
      {({ work, glyph, state, meta, cardHandlers }) => (
        <div
          className="flex min-w-0"
          style={{ height: item.height }}
          data-testid={`run-tree-row-${agent.id}`}
          data-highlighted={isHighlighted}
          onMouseEnter={onHighlight === undefined ? undefined : () => onHighlight(true)}
          onMouseLeave={onHighlight === undefined ? undefined : () => onHighlight(false)}
        >
          <span
            className="relative shrink-0"
            style={{ width: slot }}
            data-testid="run-tree-rail-slot"
          >
            <TimelineRail rail={rail} width={slot} />
            {rail.markerY == null ? null : (
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
                data-rail-column={rail.markerColumn}
              >
                <TimelineRowMarker item={item} progress={work.time?.progress ?? null} />
              </span>
            )}
          </span>
          <div className={cn(WORK_ROW.container, 'flex min-w-0 flex-1 items-end')}>
            <div
              className="flex min-w-0 flex-1"
              style={{ height: boxHeight }}
              onFocus={cardHandlers.onFocus}
              onBlur={cardHandlers.onBlur}
              onKeyDown={cardHandlers.onKeyDown}
              onPointerDown={cardHandlers.onPointerDown}
            >
              <InteractiveRow
                label={label}
                isSelected={isSelected}
                onOpen={onSelect}
                frameClassName={cn('min-w-0 flex-1', isHighlighted && 'bg-hover text-foreground')}
                className="flex h-full min-w-0 items-center gap-2 px-2"
              >
                <span className="w-6 shrink-0 text-right text-chip text-faint-foreground">
                  {entry.stepLabel}
                </span>
                {glyph}
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    title={agent.name}
                    className={cn(
                      WORK_ROW.title,
                      'flex-1 truncate',
                      isNested ? 'text-label' : 'text-body',
                      item.rowState.phase === 'queued'
                        ? 'text-muted-foreground'
                        : item.rowState.phase === 'running' || item.hasUnread
                          ? 'font-medium text-foreground'
                          : 'text-foreground',
                    )}
                  >
                    {agent.name}
                  </span>
                  {guidance === null ? null : (
                    <Tooltip content={guidanceTagTip({ text: guidance })} side="top">
                      <span
                        aria-label={`Guidance: ${guidanceTagTip({ text: guidance })}`}
                        className={cn(
                          'pointer-events-auto inline-flex shrink-0 cursor-default items-center gap-1 text-chip',
                          tintClasses('info').text,
                        )}
                      >
                        <SlidersHorizontal size={ICON_SIZE.mark} aria-hidden />
                        Guidance
                      </span>
                    </Tooltip>
                  )}
                  {answersFor === null ? null : (
                    <span className="max-w-40 shrink-0 truncate text-meta text-muted-foreground">
                      {`answering for ${answersFor}`}
                    </span>
                  )}
                </span>
                {state}
                {meta}
                {hasActionColumn ? (
                  <span className={WORK_META_COLUMN.action}>
                    {isSkipShown && skip !== null ? (
                      <RunStepSkip agent={agent} skip={skip} />
                    ) : null}
                    {answer === null ? null : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 shrink-0"
                        onClick={() => onAnswer(answer.question)}
                      >
                        Answer
                      </Button>
                    )}
                    {planAction === null ? null : (
                      <Button
                        variant={isPlanHeld ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 shrink-0"
                        onClick={() =>
                          openPlanDrawer({ sessionId: agent.sessionId, planId: planAction.id })
                        }
                      >
                        {isPlanHeld ? 'Review plan' : 'Open plan'}
                      </Button>
                    )}
                  </span>
                ) : null}
              </InteractiveRow>
            </div>
          </div>
        </div>
      )}
    </AgentStepRow>
  );
};
