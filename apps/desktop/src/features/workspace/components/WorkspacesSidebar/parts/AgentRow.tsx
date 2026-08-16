import { useEffect, useState } from 'react';
import { CircleCheck, PanelRight, RotateCcw, Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import { contextTokensForUsage } from '@goodboy/core';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { modelLabel } from '../../../../../features/chat/utils/chat-constants';
import { agentHasUnread } from '../../../../../store';
import { formatCost } from '../../../../../features/session/agent-row-format';
import { agentKindPalette, type AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import { AgentCard } from '../../../../../features/session/components/AgentCard';
import { AgentCardAction } from '../../../../../features/session/components/AgentCard/AgentCardAction';
import { AgentStatusIcon } from '../../../../../features/session/components/AgentCard/AgentStatusIcon';
import { AgentCardTitle } from '../../../../../features/session/components/AgentCard/AgentCardTitle';
import { agentCardTone } from '../../../../../features/session/components/AgentCard/agentCardTone';
import type { AgentCardDensity } from '../../../../../features/session/components/AgentCard/agentCardDensity';
import {
  AgentMetrics,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetrics';
import { useHoverMarkViewed } from '../../../../../features/session/hooks/useHoverMarkViewed';
import type { ProviderContextUsage } from './ContextWindowBar';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
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
  readonly density?: AgentCardDensity;
  readonly isInspected?: boolean;
  readonly isMuted?: boolean;
  readonly onInspect?: () => void;
  readonly onMarkDone?: () => void;
  readonly onReopen?: () => void;
};

export const AgentRow = ({
  run,
  kind,
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
  density = 'sidebar',
  isInspected = false,
  isMuted = false,
  onInspect,
  onMarkDone,
  onReopen,
}: Props) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [isEditing]);

  const lastTurnContextTokens = telemetry == null ? null : contextTokensForUsage(telemetry);
  const lastTurn =
    telemetry == null
      ? null
      : lastTurnContextTokens == null
        ? `Last turn: ${formatCost(telemetry.estimatedCostUsd)}`
        : `Last turn: ${lastTurnContextTokens} tokens · ${formatCost(telemetry.estimatedCostUsd)}`;
  const titleParts = [
    `Agent ${run.ordinal + 1}`,
    `Status: ${run.status}`,
    isSelected ? 'Selected: chat shows this agent' : 'Click to switch chat to this agent',
    telemetry != null ? `Provider: ${telemetry.provider}` : null,
    telemetry != null ? `Model: ${modelLabel(telemetry.model)}` : null,
    lastTurn,
  ].filter((part): part is string => part !== null);
  const isMarkDoneAvailable =
    onMarkDone !== undefined && run.status !== 'running' && run.doneAt == null;
  const isReopenAvailable = onReopen !== undefined && run.doneAt != null;
  const hasUnread = agentHasUnread(run, isSelected && isTaskActive);
  const hoverMarkViewed = useHoverMarkViewed({
    sessionId: run.sessionId,
    agentId: run.id,
    hasUnread,
  });

  return (
    <AgentCard
      tone={agentCardTone({
        isRunning: run.status === 'running',
        hasUnread,
      })}
      density={density}
      isSelected={isSelected}
      isInspected={isInspected}
      isMuted={isMuted}
      isInert={isEditing}
      rowTitle={titleParts.join('\n')}
      onOpen={onClick}
      onRenameStart={onRenameStart}
      onMouseEnter={hoverMarkViewed.onMouseEnter}
      onMouseLeave={hoverMarkViewed.onMouseLeave}
      leading={
        <>
          <span
            aria-hidden
            className="w-4 shrink-0 text-right text-2xs tabular-nums text-muted-foreground/60"
          >
            {run.ordinal + 1}.
          </span>
          <AgentStatusIcon status={run.status} />
        </>
      }
      title={
        <AgentCardTitle
          name={run.name}
          isEditing={isEditing}
          isSelected={isSelected}
          density={density}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
        />
      }
      navigationAction={
        onInspect !== undefined ? (
          <AgentCardAction
            icon={PanelRight}
            label="Toggle agent details"
            pressed={isInspected}
            highlighted={isInspected}
            onClick={onInspect}
          />
        ) : (
          <span className="size-6" aria-hidden />
        )
      }
      lifecycleActions={
        <>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {isMarkDoneAvailable && (
              <AgentCardAction
                icon={CircleCheck}
                label="Mark agent done"
                tone="success"
                reveal
                onClick={() => onMarkDone?.()}
              />
            )}
            {isReopenAvailable && (
              <AgentCardAction
                icon={RotateCcw}
                label="Reopen agent"
                reveal
                onClick={() => onReopen?.()}
              />
            )}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center">
            <AgentCardAction
              icon={Trash2}
              label="Delete agent"
              tone="danger"
              highlighted={isConfirmingDelete}
              reveal={!isConfirmingDelete}
              onClick={() => setIsConfirmingDelete(true)}
            />
          </span>
        </>
      }
      status={
        <AgentKindChip
          kind={kind}
          title={`Agent ${run.ordinal + 1}: ${agentKindPalette({ kind }).label}`}
        />
      }
      meta={
        <AgentMetrics
          run={run}
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
          density="lane"
        />
      }
      confirmation={
        isConfirmingDelete ? (
          <InlineConfirm
            role="danger"
            icon={<Trash2 size={12} aria-hidden />}
            title="Delete agent?"
            description="Removes this agent and its transcript from the session."
            confirmLabel="Delete"
            onConfirm={() => {
              setIsConfirmingDelete(false);
              onDelete();
            }}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        ) : null
      }
    />
  );
};
