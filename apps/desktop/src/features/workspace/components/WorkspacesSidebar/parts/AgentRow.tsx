import { CircleCheck, PanelRight } from 'lucide-react';
import type { Agent, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import { formatCost } from '../../../../../features/session/agent-row-format';
import { AGENT_KIND_PALETTE, type AgentKind } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../features/session/components/AgentKindChip';
import { AgentCard } from '../../../../../features/session/components/AgentCard';
import { AgentCardAction } from '../../../../../features/session/components/AgentCard/AgentCardAction';
import { AgentCardActions } from '../../../../../features/session/components/AgentCard/AgentCardActions';
import { AgentCardDeleteAction } from '../../../../../features/session/components/AgentCard/AgentCardDeleteAction';
import { AgentCardTitle } from '../../../../../features/session/components/AgentCard/AgentCardTitle';
import { agentCardTone } from '../../../../../features/session/components/AgentCard/agentCardTone';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../../features/session/components/AgentMetricsBlock';
import { AgentMetricsInline } from '../../../../../features/session/components/AgentMetricsInline';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
import { AgentStatusBadge } from './AgentStatusBadge';

const ACTIONS_CLASS = 'w-40';
const COMPACT_ACTIONS_CLASS = 'w-20';

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
  readonly isInspected?: boolean;
  readonly isMuted?: boolean;
  readonly onInspect?: () => void;
  readonly onMarkDone?: () => void;
};

export const AgentRow = ({
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
  isInspected = false,
  isMuted = false,
  onInspect,
  onMarkDone,
}: Props) => {
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
  ].filter((part): part is string => part !== null);
  const isMarkDoneAvailable =
    onMarkDone !== undefined && run.status !== 'running' && run.doneAt == null;

  return (
    <AgentCard
      tone={agentCardTone({
        isRunning: run.status === 'running',
        hasUnread: agentHasUnread(run, isSelected && isTaskActive),
      })}
      isSelected={isSelected}
      isInspected={isInspected}
      isMuted={isMuted}
      isInert={isEditing}
      rowTitle={titleParts.join('\n')}
      onOpen={onClick}
      onRenameStart={onRenameStart}
      leading={
        <>
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
      trailing={<AgentStatusBadge status={run.status} />}
      actions={
        <AgentCardActions
          className={onInspect === undefined ? COMPACT_ACTIONS_CLASS : ACTIONS_CLASS}
        >
          {onInspect !== undefined && (
            <AgentCardAction
              icon={PanelRight}
              label="Toggle agent details"
              text="Details"
              pressed={isInspected}
              active={isInspected}
              onClick={onInspect}
            />
          )}
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
          <AgentCardDeleteAction
            label="delete agent"
            confirmLabel="confirm delete agent"
            cancelLabel="cancel delete agent"
            resetToken={isEditing}
            reveal
            onDelete={onDelete}
          />
        </AgentCardActions>
      }
    >
      <div className="flex flex-col gap-0.5">
        <AgentMetricsInline
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
        />
        <AgentMetricsBlock run={run} aggregate={aggregate} />
        <ContextWindowBar usage={contextUsage} />
      </div>
    </AgentCard>
  );
};
