import { useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';
import { Trash2 } from 'lucide-react';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import { formatCost } from '../../../../../features/session/agent-row-format';
import { AGENT_KIND_PALETTE, type AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetricsBlock';
import { ProviderIcon } from '../../../../../features/providers/components/ProviderIcon';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
import { AgentLifetime } from './AgentLifetime';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly index: number;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isEditing: boolean;
  readonly onClick: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
  readonly onDelete: () => void;
};

export function AgentRow({
  run,
  kind,
  index,
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  isSelected,
  isTaskActive,
  isEditing,
  onClick,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: Props) {
  const total = telemetry ? telemetry.inputTokens + telemetry.outputTokens : null;
  const titleParts = [
    `agent ${run.ordinal + 1}`,
    `status: ${run.status}`,
    isSelected ? 'selected: chat shows this agent' : 'click to switch chat to this agent',
    telemetry ? `provider: ${telemetry.provider}` : null,
    telemetry ? `model: ${telemetry.model}` : null,
    total !== null
      ? `last turn: ${total} tokens · ${formatCost(telemetry!.estimatedCostUsd)}`
      : null,
  ].filter((p): p is string => p !== null);

  const [draft, setDraft] = useState(run.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (isEditing) {
      setDraft(run.name);
    }
  }, [isEditing, run.name]);
  useEffect(() => {
    if (isEditing) {
      setConfirmingDelete(false);
    }
  }, [isEditing]);

  return (
    <li
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? -1 : 0}
      aria-pressed={isEditing ? undefined : isSelected}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onRenameStart}
      onKeyDown={(e) => {
        if (isEditing) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group rounded border transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-elevated' : 'bg-muted/40 hover:bg-muted/60',
        run.status === 'running'
          ? 'border-info/60'
          : agentHasUnread(run, isSelected && isTaskActive)
            ? 'border-warning/70'
            : isSelected
              ? 'border-border'
              : 'border-transparent',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" title={titleParts.join('\n')}>
        <span
          aria-hidden
          className="w-4 shrink-0 text-right text-2xs tabular-nums text-muted-foreground/60"
        >
          {index + 1}.
        </span>
        <AgentKindChip
          kind={kind}
          title={`agent ${run.ordinal + 1}: ${AGENT_KIND_PALETTE[kind].label}`}
        />
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
              isSelected ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {run.name}
          </span>
        )}
        {!isEditing &&
          (confirmingDelete ? (
            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded px-1 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete();
                }}
                className="rounded px-1 py-0.5 text-2xs font-medium text-danger transition-colors hover:bg-danger/10"
                title="confirm delete"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <ProviderIcon provider={telemetry?.provider} variant="glyph" />
              <span className="text-2xs text-muted-foreground/70 group-hover:hidden">
                <AgentLifetime run={run} />
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                className="hidden rounded p-0.5 text-muted-foreground/60 transition-colors group-hover:inline-flex hover:text-danger"
                title="delete agent (double-click row to rename)"
                aria-label="delete agent"
              >
                <Trash2 size={11} aria-hidden />
              </button>
            </div>
          ))}
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isSelected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 px-2 pb-1.5">
            <AgentMetricsBlock
              run={run}
              telemetry={telemetry}
              aggregate={aggregate}
              turns={turns}
              turnsLoading={turnsLoading}
              variant="adhoc"
            />
            <ContextWindowBar usage={contextUsage} />
          </div>
        </div>
      </div>
    </li>
  );
}
