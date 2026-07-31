import { useEffect, useState } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import { AlertTriangle, Check, Clock, Play } from 'lucide-react';
import type { Agent, ProviderId, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import {
  AgentMetrics,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetrics';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
import { WorkflowStepPlanBadge } from './WorkflowStepPlanBadge';
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../../../../workflows/blockCopy';
import { useHoverMarkViewed } from '../../../../../features/session/hooks/useHoverMarkViewed';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly resolvedModel: string;
  readonly resolvedProvider: ProviderId;
  readonly isActionable: boolean;
  readonly blockReason: WorkflowBlockReason | null;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isEditing: boolean;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly onStart: () => void;
  readonly onSelect: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
  readonly onResolveFirst?: () => void;
};

export const WorkflowStepRow = ({
  run,
  kind,
  index,
  resolvedModel,
  resolvedProvider,
  isActionable,
  blockReason,
  isSelected,
  isTaskActive,
  isEditing,
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  onStart,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onResolveFirst,
}: Props) => {
  const isBlocked = blockReason !== null;
  const isPendingFuture = run.status === 'pending' && !isActionable;
  const isStartable = isActionable && !isBlocked;
  const isRunning = run.status === 'running';
  const hasUnread = agentHasUnread(run, isSelected && isTaskActive);
  const hoverMarkViewed = useHoverMarkViewed({
    sessionId: run.sessionId,
    agentId: run.id,
    hasUnread,
  });
  const [draft, setDraft] = useState(run.name);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  useEffect(() => {
    if (isEditing) {
      setDraft(run.name);
    }
  }, [isEditing, run.name]);
  useEffect(() => {
    if (!isBlocked) {
      setPendingConfirm(false);
    }
  }, [isBlocked]);

  const handleRowClick = () => {
    if (isPendingFuture) {
      return;
    }
    if (isStartable) {
      onStart();
    } else if (isActionable && isBlocked) {
      setPendingConfirm(true);
    } else {
      onSelect();
    }
  };

  const containerClass = cn(
    'group overflow-hidden rounded-lg border transition-colors',
    isPendingFuture
      ? 'border-transparent'
      : isStartable
        ? 'border-primary/45 bg-primary/[0.06]'
        : isActionable && isBlocked
          ? 'border-warning/60 bg-warning/[0.06]'
          : isRunning
            ? cn('border-info/60', isSelected ? 'bg-elevated' : 'bg-muted/40')
            : hasUnread
              ? 'border-warning/70 bg-muted/40'
              : isSelected
                ? 'border-border bg-elevated'
                : 'border-transparent bg-muted/40',
  );

  const renderStatusIcon = () => {
    if (isStartable) {
      return (
        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary/15">
          <Play size={9} className="text-primary" aria-hidden fill="currentColor" />
        </span>
      );
    }
    if (isActionable && isBlocked) {
      return <AlertTriangle size={12} className="text-warning" aria-hidden />;
    }
    if (isRunning) {
      return <StatusDot tone="info" size="md" pulsing />;
    }
    if (run.status === 'completed' || run.status === 'skipped') {
      return (
        <span
          className={cn(
            'flex size-3.5 items-center justify-center rounded-full',
            run.status === 'skipped' ? 'bg-muted' : 'bg-success/15',
          )}
        >
          <Check
            size={9}
            className={run.status === 'skipped' ? 'text-muted-foreground/60' : 'text-success'}
            aria-hidden
          />
        </span>
      );
    }
    if (run.status === 'failed') {
      return <StatusDot tone="danger" size="sm" />;
    }
    return <Clock size={11} className="text-muted-foreground/50" aria-hidden />;
  };

  const stableTitle =
    isActionable && isBlocked && blockReason !== null
      ? `next workflow step. ${WORKFLOW_BLOCK_COPY[blockReason]} click to force`
      : isPendingFuture
        ? 'waiting for previous steps'
        : `agent ${run.ordinal + 1}: ${run.status}`;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={containerClass}
        data-testid="workflow-step-card"
        onMouseEnter={hoverMarkViewed.onMouseEnter}
        onMouseLeave={hoverMarkViewed.onMouseLeave}
      >
        <div
          role={isPendingFuture ? undefined : 'button'}
          tabIndex={isEditing || isPendingFuture ? -1 : 0}
          aria-pressed={isPendingFuture ? undefined : isSelected}
          title={stableTitle}
          onClick={isEditing || isPendingFuture ? undefined : handleRowClick}
          onDoubleClick={isEditing || isPendingFuture ? undefined : onRenameStart}
          onKeyDown={(e) => {
            if (isEditing) {
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleRowClick();
            }
          }}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 transition-colors',
            !isEditing && !isPendingFuture && 'cursor-pointer hover:bg-foreground/[0.04]',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'w-4 shrink-0 text-right text-2xs tabular-nums',
              isPendingFuture ? 'text-muted-foreground/40' : 'text-muted-foreground/60',
            )}
          >
            {index + 1}.
          </span>
          <span className="flex size-3.5 shrink-0 items-center justify-center">
            {renderStatusIcon()}
          </span>
          <AgentKindChip kind={kind} muted={isPendingFuture} />
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onRenameCommit(draft);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onRenameCancel();
                }
              }}
              onBlur={() => onRenameCommit(draft)}
              className="line-clamp-1 flex-1 rounded-full bg-background px-1.5 py-0.5 text-2xs font-medium text-foreground outline-none ring-1 ring-primary"
              aria-label="rename agent"
            />
          ) : (
            <span
              className={cn(
                'line-clamp-1 flex-1 text-left text-2xs font-medium',
                isPendingFuture
                  ? 'text-muted-foreground/50'
                  : isSelected
                    ? 'text-foreground'
                    : 'text-muted-foreground',
              )}
            >
              {run.name}
            </span>
          )}
          <WorkflowStepPlanBadge run={run} kind={kind} />
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-1.5">
          <AgentMetrics
            run={run}
            telemetry={telemetry}
            aggregate={aggregate}
            contextUsage={contextUsage}
            turns={turns}
            turnsLoading={turnsLoading}
            plannedModel={resolvedModel}
            plannedProvider={resolvedProvider}
            muted={isPendingFuture}
            density={isPendingFuture ? 'compact' : 'full'}
          />
          <ContextWindowBar usage={contextUsage} />
        </div>
      </div>
      {pendingConfirm && blockReason !== null ? (
        <div className="flex items-center gap-2 rounded-md bg-warning/5 px-2.5 py-1.5 text-[11px]">
          <AlertTriangle size={12} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {WORKFLOW_BLOCK_COPY[blockReason]}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingConfirm(false);
              if (blockReason === 'questions') {
                onResolveFirst?.();
              }
            }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {blockReason === 'questions' ? 'Resolve first' : 'Wait'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingConfirm(false);
              onStart();
            }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-warning transition-colors hover:bg-warning/10"
          >
            Force start
          </button>
        </div>
      ) : null}
    </div>
  );
};
