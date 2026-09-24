import { useEffect, useState } from 'react';
import { CircleCheck, PanelRight, RotateCcw, Trash2 } from 'lucide-react';
import { Chip, InlineConfirm } from '@goodboy/ui';
import { contextTokensForUsage } from '@goodboy/core';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { agentHasUnread } from '../../../../store';
import { formatCost } from '../../agent-row-format';
import { agentKindPalette, type AgentKind } from '../../agent-kind';
import { isAgentClosedByUser } from '../../agent-lifecycle';
import { AgentKindChip } from '../AgentKindChip';
import { AgentCard } from '../AgentCard';
import { AgentCardAction } from '../AgentCard/AgentCardAction';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';
import { AgentCardTitle } from '../AgentCard/AgentCardTitle';
import { agentCardTone } from '../AgentCard/agentCardTone';
import type { AgentCardDensity } from '../AgentCard/agentCardDensity';
import { AgentMetrics, type AgentAggregate } from '../AgentMetrics';
import { useHoverMarkViewed } from '../../hooks/useHoverMarkViewed';
import type { ProviderContextUsage } from './ContextWindowBar';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly delegatedChildCount?: number;
  readonly activeDelegatedChildCount?: number;
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
  readonly onClose?: () => void;
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
  delegatedChildCount = 0,
  activeDelegatedChildCount = 0,
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
  onClose,
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
            className="w-4 shrink-0 text-right text-2xs tabular-nums text-faint-foreground"
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
            {onClose !== undefined && (
              <AgentCardAction icon={CircleCheck} label="Close agent" reveal onClick={onClose} />
            )}
            {onReopen !== undefined && (
              <AgentCardAction icon={RotateCcw} label="Reopen agent" reveal onClick={onReopen} />
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
        <>
          <AgentKindChip
            kind={kind}
            title={`Agent ${run.ordinal + 1}: ${agentKindPalette({ kind }).label}`}
          />
          {isMuted &&
            (isAgentClosedByUser({ agent: run }) ? (
              <Chip tone="neutral" size="xs" bordered={false} label="closed by you" />
            ) : (
              <Chip tone="success" size="xs" bordered={false} label="completed" />
            ))}
        </>
      }
      meta={
        <AgentMetrics
          run={run}
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
          delegatedChildCount={delegatedChildCount}
          activeDelegatedChildCount={activeDelegatedChildCount}
          density="lane"
        />
      }
      confirmation={
        isConfirmingDelete ? (
          <InlineConfirm
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
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
