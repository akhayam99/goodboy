import { useEffect, useState, type ReactNode } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Play } from 'lucide-react';
import type { Agent, Step, TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import { agentHasUnread } from '../../../../../store';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetricsBlock';
import { AgentMetricsInline } from '../../../../../features/session/components/AgentMetricsInline';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
import { WorkflowStepBrief } from './WorkflowStepBrief';
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../../../../workflows/blockCopy';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly step?: Step;
  readonly showBrief?: boolean;
  readonly detailContent?: ReactNode;
  readonly resolvedModel: string;
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
  step,
  showBrief = false,
  detailContent,
  resolvedModel,
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
  const promptPrefix = step?.promptPrefix.trim() ?? '';
  const expectedOutput = step?.expectedOutput?.trim() ?? '';
  const outputSummary = run.outputSummary?.trim() ?? '';
  const hasBrief =
    showBrief && (promptPrefix !== '' || expectedOutput !== '' || outputSummary !== '');

  const [draft, setDraft] = useState(run.name);
  const [briefOpen, setBriefOpen] = useState(false);
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
    'group rounded border transition-colors',
    isEditing || isPendingFuture ? '' : 'cursor-pointer',
    isPendingFuture
      ? 'border-transparent'
      : isStartable
        ? 'border-primary/45 bg-primary/[0.06] hover:bg-primary/[0.1]'
        : isActionable && isBlocked
          ? 'border-warning/60 bg-warning/[0.06] hover:bg-warning/[0.1]'
          : isRunning
            ? cn('border-info/60', isSelected ? 'bg-elevated' : 'bg-muted/40')
            : hasUnread
              ? 'border-warning/70 bg-muted/40 hover:bg-muted/60'
              : isSelected
                ? 'border-border bg-elevated'
                : 'border-transparent bg-muted/40 hover:bg-muted/60',
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
      return <span className="size-1.5 rounded-full bg-danger" aria-hidden />;
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
        className={containerClass}
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
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
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-1.5">
          <AgentMetricsInline
            telemetry={telemetry}
            aggregate={aggregate}
            contextUsage={contextUsage}
            turns={turns}
            turnsLoading={turnsLoading}
            plannedModel={resolvedModel}
            muted={isPendingFuture}
          />
          <AgentMetricsBlock run={run} aggregate={aggregate} />
          <ContextWindowBar usage={contextUsage} />
        </div>
      </div>
      {hasBrief ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setBriefOpen((open) => !open)}
            aria-expanded={briefOpen}
            aria-label={`${briefOpen ? 'hide' : 'show'} details for ${run.name}`}
            className="flex items-center gap-1 self-start rounded text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {briefOpen ? (
              <ChevronDown size={11} aria-hidden className="shrink-0" />
            ) : (
              <ChevronRight size={11} aria-hidden className="shrink-0" />
            )}
            Details
          </button>
          {briefOpen ? (
            <WorkflowStepBrief
              promptPrefix={promptPrefix}
              expectedOutput={expectedOutput}
              outputSummary={outputSummary}
            />
          ) : null}
        </div>
      ) : null}
      {detailContent ?? null}
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
