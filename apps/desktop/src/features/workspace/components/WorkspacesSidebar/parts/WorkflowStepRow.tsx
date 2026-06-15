import { useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';
import { AlertTriangle, ArrowRight, Check, Clock, Loader2, Play } from 'lucide-react';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import { agentHasUnread } from '../../../../../store';
import { formatCost } from '../../../../../features/session/agent-row-format';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetricsBlock';
import { ProviderGlyph } from './ProviderGlyph';
import { ContextWindowBar } from './ContextWindowBar';
import type { WorkflowBlockReason } from '../lib';

type WorkflowStepRowProps = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly resolvedModel: string;
  readonly isActionable: boolean;
  readonly blockReason: WorkflowBlockReason | null;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isEditing: boolean;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly onStart: () => void;
  readonly onSelect: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
};

export function WorkflowStepRow({
  run,
  kind,
  index,
  resolvedModel,
  isActionable,
  blockReason,
  isSelected,
  isTaskActive,
  isEditing,
  telemetry,
  aggregate,
  turns,
  turnsLoading,
  onStart,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
}: WorkflowStepRowProps) {
  const isBlocked = blockReason !== null;
  const isPendingFuture = run.status === 'pending' && !isActionable;
  const modelLabel = resolvedModel.split('-').slice(1, 3).join('-');
  const isStartable = isActionable && !isBlocked;
  const stepCost = aggregate?.estimatedCostUsd ?? telemetry?.estimatedCostUsd ?? 0;

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

  const ROW_BASE = 'group flex w-full flex-col rounded border px-2 py-1.5 text-xs font-medium';
  const isRunning = run.status === 'running';
  const hasUnread = agentHasUnread(run, isSelected && isTaskActive);
  const containerClass = isRunning
    ? cn(
        `${ROW_BASE} border-info/60 transition-colors cursor-pointer`,
        isSelected ? 'bg-elevated text-foreground' : 'bg-muted/40 text-foreground/80',
      )
    : isStartable
      ? `${ROW_BASE} border-primary/40 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 cursor-pointer`
      : isActionable && isBlocked
        ? `${ROW_BASE} border-warning/70 bg-warning/10 text-foreground transition-colors hover:bg-warning/15 cursor-pointer`
        : hasUnread
          ? `${ROW_BASE} border-warning/70 bg-muted/40 text-foreground/80 transition-colors hover:border-warning hover:bg-muted/60 cursor-pointer`
          : isPendingFuture
            ? `${ROW_BASE} border-transparent text-muted-foreground/40`
            : cn(
                `${ROW_BASE} transition-colors cursor-pointer`,
                isSelected
                  ? 'border-border bg-elevated text-foreground'
                  : 'border-border-soft/50 bg-muted/40 text-foreground/80 hover:border-border hover:bg-muted/60',
              );

  const renderStatusIcon = () => {
    if (isStartable) {
      return (
        <span className="relative inline-flex size-3.5">
          <span
            className="absolute inset-0 animate-ping rounded-full bg-primary/30 opacity-75"
            aria-hidden
          />
          <span className="relative flex size-3.5 items-center justify-center rounded-full bg-primary/15">
            <Play size={9} className="text-primary" aria-hidden fill="currentColor" />
          </span>
        </span>
      );
    }
    if (isActionable && isBlocked) {
      return <AlertTriangle size={12} className="text-warning" aria-hidden />;
    }
    if (run.status === 'running') {
      return <Loader2 size={11} className="animate-spin text-info" aria-hidden />;
    }
    if (run.status === 'completed') {
      return (
        <span className="flex size-3.5 items-center justify-center rounded-full bg-success/15">
          <Check size={9} className="text-success" aria-hidden />
        </span>
      );
    }
    if (run.status === 'failed') {
      return <span className="size-1.5 rounded-full bg-danger" aria-hidden />;
    }
    return <Clock size={11} className="text-muted-foreground/70" aria-hidden />;
  };

  const renderActionIndicator = () => {
    if (run.status === 'running') {
      return null;
    }
    if (isActionable && isBlocked) {
      return <ArrowRight size={13} aria-hidden className="text-warning" />;
    }
    return null;
  };

  const stableTitle =
    isActionable && isBlocked
      ? blockReason === 'summarizer'
        ? 'next workflow step. waiting for the summarizer to finish (click to force)'
        : 'next workflow step. gated by open questions (click to force)'
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
        <div className="flex w-full items-center gap-1.5">
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
              className="min-w-0 flex-1 rounded bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground outline-none ring-1 ring-primary"
              aria-label="rename agent"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-left font-semibold">{run.name}</span>
          )}
          {renderActionIndicator()}
        </div>
        <div className="flex w-full items-center justify-between gap-2 pl-[22px] pt-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <ProviderGlyph
              provider={telemetry?.provider ?? getModelProvider(resolvedModel)}
              muted={isPendingFuture}
            />
            <span
              className={cn(
                'min-w-0 truncate text-[10px] font-normal tabular-nums',
                isPendingFuture ? 'text-muted-foreground/60' : 'opacity-60',
              )}
              title={`model: ${resolvedModel}`}
            >
              {modelLabel}
            </span>
          </span>
          {stepCost > 0 && (
            <span
              className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60"
              title={`estimated cost: ${formatCost(stepCost)}`}
            >
              {formatCost(stepCost)}
            </span>
          )}
        </div>
        <div
          className={cn(
            'grid w-full transition-[grid-template-rows] duration-200 ease-out',
            isSelected && !isPendingFuture ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 pt-1">
              <AgentMetricsBlock
                run={run}
                telemetry={telemetry}
                aggregate={aggregate}
                turns={turns}
                turnsLoading={turnsLoading}
                variant="workflow"
              />
              <ContextWindowBar telemetry={telemetry} aggregate={aggregate} />
            </div>
          </div>
        </div>
      </div>
      {pendingConfirm ? (
        <div className="flex items-center gap-2 rounded-md bg-warning/5 px-2.5 py-1.5 text-[11px]">
          <AlertTriangle size={12} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {blockReason === 'summarizer' ? 'Summarizer still running.' : 'Open questions first.'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingConfirm(false);
            }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {blockReason === 'summarizer' ? 'Wait' : 'Resolve first'}
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
}
