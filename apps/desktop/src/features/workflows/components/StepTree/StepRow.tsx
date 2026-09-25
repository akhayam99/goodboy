import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { Tooltip, WORK_META_COLUMN, WorkMeta, WorkNode, cn } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import { WorkTimeCell } from '../../../workTreeModel/components/WorkTimeCell';
import type { PlanStepEstimate } from '../../../session/components/WorkflowBuilderView/planEstimates';
import { ROLE_LABEL, type AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { StepTreeGutter } from './StepTreeGutter';
import type { StepLaneSpan } from './StepTreeLane';

type Props = {
  readonly step: StepDraft;
  readonly ordinal: number;
  readonly kind: AgentKind;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly estimate: PlanStepEstimate | null | undefined;
  readonly span: StepLaneSpan;
  readonly identityIndex: number;
  readonly isExpanded: boolean;
  readonly isEdited: boolean;
  readonly isDragging: boolean;
  readonly disabled: boolean;
  readonly editor: ReactNode;
  readonly onToggle: () => void;
  readonly onStartDrag: (event: PointerEvent) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
};

export const StepRow = ({
  step,
  ordinal,
  kind,
  provider,
  model,
  effort,
  estimate,
  span,
  identityIndex,
  isExpanded,
  isEdited,
  isDragging,
  disabled,
  editor,
  onToggle,
  onStartDrag,
  onMoveUp,
  onMoveDown,
}: Props) => {
  const displayName = step.name.trim() === '' ? ROLE_LABEL[step.role] : step.name.trim();

  const onGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMoveUp();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMoveDown();
    }
  };

  return (
    <li
      className={cn('flex min-w-0 gap-1.5', isDragging && 'opacity-40')}
      data-plan-step={step.key}
    >
      <StepTreeGutter
        span={span}
        identityIndex={identityIndex}
        node={
          <WorkNode
            state="queued"
            mark={{ kind: 'index', value: String(ordinal) }}
            label={`Step ${ordinal}, not started`}
          />
        }
      />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col rounded-lg border',
          isExpanded ? 'border-border-soft bg-subtle' : 'border-transparent',
        )}
      >
        <div
          className={cn(
            'group/plan-row flex h-8 min-w-0 items-center gap-2 rounded-md pr-1 transition-colors',
            !isExpanded && 'hover:bg-hover',
          )}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={`Step ${ordinal}: ${displayName}`}
            className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-md pl-2 text-left"
          >
            <AgentKindChip kind={kind} label={ROLE_LABEL[step.role]} />
            <span
              className={cn(
                'min-w-0 truncate text-sm leading-5 text-foreground',
                isExpanded && 'font-medium',
              )}
            >
              {displayName}
            </span>
            {isEdited ? (
              <span className="inline-flex shrink-0 items-center">
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                <span className="sr-only">Edited</span>
              </span>
            ) : null}
          </button>
          <WorkMeta
            isPlanned
            isCostRange={estimate !== undefined}
            routing={<RoutingLabel isColumn provider={provider} model={model} effort={effort} />}
            time={
              estimate === undefined ? undefined : <WorkTimeCell time={estimate?.time ?? null} />
            }
            cost={estimate === undefined ? undefined : (estimate?.cost ?? null)}
          />
          <span className={WORK_META_COLUMN.menu}>
            <Tooltip content="Drag or use the arrow keys to reorder">
              <button
                type="button"
                onPointerDown={onStartDrag}
                onKeyDown={onGripKeyDown}
                disabled={disabled}
                aria-label={`Reorder step ${ordinal} (drag or arrow keys)`}
                className="inline-flex size-6 cursor-grab touch-none items-center justify-center rounded-md text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed group-hover/plan-row:opacity-100"
              >
                <GripVertical size={ICON_SIZE.control} aria-hidden />
              </button>
            </Tooltip>
          </span>
        </div>
        {isExpanded ? editor : null}
      </div>
    </li>
  );
};
