import { useEffect, useState } from 'react';
import { CircleCheck, PanelRight, Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import { contextTokensForUsage } from '@goodboy/core';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { modelLabel } from '../../../../../features/chat/utils/chat-constants';
import { agentHasUnread } from '../../../../../store';
import { formatCost } from '../../../../../features/session/agent-row-format';
import { AGENT_KIND_PALETTE, type AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import { AgentCard } from '../../../../../features/session/components/AgentCard';
import { AgentCardAction } from '../../../../../features/session/components/AgentCard/AgentCardAction';
import { AgentCardActions } from '../../../../../features/session/components/AgentCard/AgentCardActions';
import { AgentStatusIcon } from '../../../../../features/session/components/AgentCard/AgentStatusIcon';
import { AgentCardTitle } from '../../../../../features/session/components/AgentCard/AgentCardTitle';
import { agentCardTone } from '../../../../../features/session/components/AgentCard/agentCardTone';
import {
  AgentMetrics,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetrics';
import { AgentLastUpdate } from '../../../../../shared/components/AgentLastUpdate';
import { useHoverMarkViewed } from '../../../../../features/session/hooks/useHoverMarkViewed';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
const ACTIONS_CLASS = 'w-20';

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
  readonly isInspected?: boolean;
  readonly isMuted?: boolean;
  readonly onInspect?: () => void;
  readonly onMarkDone?: () => void;
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
  isInspected = false,
  isMuted = false,
  onInspect,
  onMarkDone,
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
        ? `last turn: ${formatCost(telemetry.estimatedCostUsd)}`
        : `last turn: ${lastTurnContextTokens} tokens · ${formatCost(telemetry.estimatedCostUsd)}`;
  const titleParts = [
    `agent ${run.ordinal + 1}`,
    `status: ${run.status}`,
    isSelected ? 'selected: chat shows this agent' : 'click to switch chat to this agent',
    telemetry != null ? `provider: ${telemetry.provider}` : null,
    telemetry != null ? `model: ${modelLabel(telemetry.model)}` : null,
    lastTurn,
  ].filter((part): part is string => part !== null);
  const isMarkDoneAvailable =
    onMarkDone !== undefined && run.status !== 'running' && run.doneAt == null;
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
          <AgentKindChip
            kind={kind}
            title={`agent ${run.ordinal + 1}: ${AGENT_KIND_PALETTE[kind].label}`}
          />
          <AgentStatusIcon status={run.status} />
        </>
      }
      title={
        <AgentCardTitle
          name={run.name}
          isEditing={isEditing}
          isSelected={isSelected}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
        />
      }
      actions={
        <AgentCardActions className={ACTIONS_CLASS}>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {onInspect !== undefined && (
              <AgentCardAction
                icon={PanelRight}
                label="Toggle agent details"
                pressed={isInspected}
                active={isInspected}
                onClick={onInspect}
              />
            )}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {isMarkDoneAvailable && (
              <AgentCardAction
                icon={CircleCheck}
                label="mark agent done"
                tone="success"
                reveal
                onClick={() => onMarkDone?.()}
              />
            )}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center">
            <AgentCardAction
              icon={Trash2}
              label="delete agent"
              tone="danger"
              active={isConfirmingDelete}
              reveal={!isConfirmingDelete}
              onClick={() => setIsConfirmingDelete(true)}
            />
          </span>
        </AgentCardActions>
      }
    >
      <div className="flex flex-col gap-0.5">
        {isConfirmingDelete && (
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
        )}
        <AgentMetrics
          run={run}
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
          density="full"
        />
        <AgentLastUpdate agent={run} />
        <ContextWindowBar usage={contextUsage} />
      </div>
    </AgentCard>
  );
};
