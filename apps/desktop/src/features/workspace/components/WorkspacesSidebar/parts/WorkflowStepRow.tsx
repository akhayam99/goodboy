import { useEffect, useState } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import { AlertTriangle, Check, Clock, Play } from 'lucide-react';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import { agentHasUnread } from '../../../../../store';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetricsBlock';
import { ProviderGlyph } from './ProviderGlyph';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
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
  contextUsage,
  turns,
  turnsLoading,
  onStart,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onResolveFirst,
}: WorkflowStepRowProps) {
  const isBlocked = blockReason !== null;
  const isPendingFuture = run.status === 'pending' && !isActionable;
  const modelLabel = resolvedModel.split('-').slice(1, 3).join('-');
  const isStartable = isActionable && !isBlocked;
  const isRunning = run.status === 'running';
  const hasUnread = agentHasUnread(run, isSelected && isTaskActive);

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

  const cardClass = cn(
    'group flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors',
    isPendingFuture
      ? 'cursor-default border-border-soft/40'
      : isStartable
        ? 'cursor-pointer border-primary/45 bg-primary/[0.06] hover:bg-primary/[0.1]'
        : isActionable && isBlocked
          ? 'cursor-pointer border-warning/55 bg-warning/[0.06] hover:bg-warning/[0.1]'
          : isRunning
            ? cn('cursor-pointer border-info/50', isSelected && 'bg-info/[0.05]')
            : hasUnread
              ? 'cursor-pointer border-warning/55 hover:border-warning'
              : isSelected
                ? 'cursor-pointer border-accent/50 bg-accent/[0.05]'
                : 'cursor-pointer border-border-soft/60 hover:border-border',
  );

  const statusLabel = isStartable
    ? 'start'
    : isActionable && isBlocked
      ? 'needs you'
      : isRunning
        ? 'running…'
        : run.status === 'completed'
          ? 'done'
          : run.status === 'skipped'
            ? 'skipped'
            : run.status === 'failed'
              ? 'stalled'
              : 'queued';

  const statusLabelClass = cn(
    'shrink-0 text-2xs font-medium uppercase tracking-wide',
    isStartable
      ? 'text-primary'
      : isActionable && isBlocked
        ? 'text-warning'
        : isRunning
          ? 'text-info'
          : run.status === 'completed'
            ? 'text-success'
            : run.status === 'failed'
              ? 'text-danger'
              : 'text-muted-foreground/50',
  );

  const renderStatusIcon = () => {
    if (isStartable) {
      return (
        <span className="flex size-4 items-center justify-center rounded-full bg-primary/15">
          <Play size={9} className="text-primary" aria-hidden fill="currentColor" />
        </span>
      );
    }
    if (isActionable && isBlocked) {
      return <AlertTriangle size={13} className="text-warning" aria-hidden />;
    }
    if (isRunning) {
      return <StatusDot tone="info" size="md" pulsing />;
    }
    if (run.status === 'completed' || run.status === 'skipped') {
      return (
        <span
          className={cn(
            'flex size-4 items-center justify-center rounded-full',
            run.status === 'skipped' ? 'bg-muted' : 'bg-success/15',
          )}
        >
          <Check
            size={10}
            className={run.status === 'skipped' ? 'text-muted-foreground/60' : 'text-success'}
            aria-hidden
          />
        </span>
      );
    }
    if (run.status === 'failed') {
      return <span className="size-2 rounded-full bg-danger" aria-hidden />;
    }
    return <Clock size={13} className="text-muted-foreground/50" aria-hidden />;
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
        className={cardClass}
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 w-3 shrink-0 text-right text-2xs tabular-nums text-muted-foreground/40"
          >
            {index + 1}
          </span>
          <span className="mt-px flex size-4 shrink-0 items-center justify-center">
            {renderStatusIcon()}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
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
                    className="min-w-0 flex-1 rounded bg-background px-1.5 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-primary"
                    aria-label="rename agent"
                  />
                ) : (
                  <span
                    className={cn(
                      'min-w-0 truncate text-sm font-medium',
                      isPendingFuture ? 'text-muted-foreground/50' : 'text-foreground',
                    )}
                  >
                    {run.name}
                  </span>
                )}
              </div>
              <span className={statusLabelClass}>{statusLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ProviderGlyph
                provider={telemetry?.provider ?? getModelProvider(resolvedModel)}
                muted={isPendingFuture}
              />
              <span
                className={cn(
                  'min-w-0 truncate text-[11px] tabular-nums',
                  isPendingFuture ? 'text-muted-foreground/50' : 'text-muted-foreground/70',
                )}
                title={`model: ${resolvedModel}`}
              >
                {modelLabel}
              </span>
            </div>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                isSelected && !isPendingFuture ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-1.5">
                  <AgentMetricsBlock
                    run={run}
                    telemetry={telemetry}
                    aggregate={aggregate}
                    turns={turns}
                    turnsLoading={turnsLoading}
                    variant="workflow"
                  />
                  <ContextWindowBar usage={contextUsage} />
                </div>
              </div>
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
              if (blockReason !== 'summarizer') {
                onResolveFirst?.();
              }
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
