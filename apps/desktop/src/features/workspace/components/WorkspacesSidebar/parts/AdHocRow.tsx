import { Fragment, type Dispatch, type SetStateAction } from 'react';
import type { Agent, AgentId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../../store';
import { resolveAgentKind, type AgentKind } from '../../../../../features/session/agent-kind';
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetrics';
import type { AgentCardDensity } from '../../../../../features/session/components/AgentCard/agentCardDensity';
import type { ProviderContextUsage } from './ContextWindowBar';
import { AgentRow } from './AgentRow';
import { ScoutSubtree } from './ScoutSubtree';

type Props = {
  readonly run: Agent;
  readonly firstUserTextByAgentId: ReadonlyMap<string, string>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly childrenByParentId: ReadonlyMap<string, Agent[]>;
  readonly latestTelemetryByAgentId: ReadonlyMap<string, TelemetryRecord>;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly providerUsageByAgentId: ReadonlyMap<string, ReadonlyArray<ProviderContextUsage>>;
  readonly turnsByAgentId: ReadonlyMap<string, number>;
  readonly selectedAgentId: AgentId | null;
  readonly isTranscriptLoading: boolean;
  readonly isTaskActive: boolean;
  readonly editingId: AgentId | null;
  readonly setEditingId: Dispatch<SetStateAction<AgentId | null>>;
  readonly clusterExpand: ReadonlyMap<string, boolean>;
  readonly toggleClusterExpand: (id: string) => void;
  readonly onPickAgent: (id: AgentId) => void;
  readonly onRenameCommit: (id: AgentId, name: string) => Promise<void>;
  readonly onDeleteAgent: (id: AgentId) => Promise<void>;
  readonly isInspected?: boolean;
  readonly onInspectAgent?: (id: AgentId) => void;
  readonly onMarkDone: (id: AgentId) => void;
  readonly onReopen?: (id: AgentId) => void;
  readonly isMuted?: boolean;
  readonly density?: AgentCardDensity;
};

export const AdHocRow = ({
  run,
  firstUserTextByAgentId,
  agentKindOverride,
  childrenByParentId,
  latestTelemetryByAgentId,
  aggregatesByAgentId,
  providerUsageByAgentId,
  turnsByAgentId,
  selectedAgentId,
  isTranscriptLoading,
  isTaskActive,
  editingId,
  setEditingId,
  clusterExpand,
  toggleClusterExpand,
  onPickAgent,
  onRenameCommit,
  onDeleteAgent,
  isInspected = false,
  onInspectAgent,
  onMarkDone,
  onReopen,
  isMuted = false,
  density = 'sidebar',
}: Props) => {
  const kind = resolveAgentKind(
    run.name,
    firstUserTextByAgentId.get(run.id) ?? null,
    agentKindOverride[run.id] ?? null,
  );
  const scoutChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
  const activeDelegatedChildCount = scoutChildren.filter(
    (child) => child.status === 'pending' || child.status === 'running',
  ).length;
  return (
    <Fragment key={run.id}>
      <AgentRow
        run={run}
        kind={kind}
        telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
        aggregate={aggregatesByAgentId.get(run.id) ?? null}
        contextUsage={providerUsageByAgentId.get(run.id) ?? EMPTY_ARRAY}
        turns={turnsByAgentId.get(run.id) ?? 0}
        turnsLoading={run.id === selectedAgentId && isTranscriptLoading}
        delegatedChildCount={scoutChildren.length}
        activeDelegatedChildCount={activeDelegatedChildCount}
        isSelected={run.id === selectedAgentId}
        isTaskActive={isTaskActive}
        isEditing={editingId === run.id}
        onClick={() => onPickAgent(run.id)}
        onRenameStart={() => setEditingId(run.id)}
        onRenameCommit={(name) => void onRenameCommit(run.id, name)}
        onRenameCancel={() => setEditingId(null)}
        onDelete={() => void onDeleteAgent(run.id)}
        isInspected={isInspected}
        onInspect={onInspectAgent === undefined ? undefined : () => onInspectAgent(run.id)}
        onMarkDone={() => onMarkDone(run.id)}
        {...(onReopen !== undefined && { onReopen: () => onReopen(run.id) })}
        isMuted={isMuted}
        density={density}
      />
      {scoutChildren.length > 0 && (
        <li>
          <ScoutSubtree
            containerId={run.id}
            depth={0}
            childrenByParentId={childrenByParentId}
            aggregatesByAgentId={aggregatesByAgentId}
            selectedAgentId={selectedAgentId}
            isTaskActive={isTaskActive}
            expandState={clusterExpand}
            onToggle={toggleClusterExpand}
            onSelect={onPickAgent}
          />
        </li>
      )}
    </Fragment>
  );
};
