import { useMemo } from 'react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  selectClusterDashboard,
  type ClusterDashboardItem,
  type InlineClusterLink,
} from '../../../chat/components/ChatView/clusterDashboard';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import { statusToNodeStatus, type SpawnNode } from '../../components/SpawnTree/lib';

const kindOf = (agent: Agent): AgentKind =>
  agent.kind != null ? (agent.kind as AgentKind) : inferAgentKindFromName(agent.name);

type CostByAgentId = ReadonlyMap<string, number>;

const buildCostByAgentId = (
  phaseRuns: ReadonlyArray<Agent>,
  telemetry: ReadonlyArray<TelemetryRecord>,
  agentRunHistory: Readonly<Record<string, ReadonlyArray<string>>>,
): CostByAgentId => {
  const latestByRun = new Map<string, TelemetryRecord>();
  for (const rec of telemetry) {
    if (rec.kind !== 'turn') {
      continue;
    }
    const existing = latestByRun.get(rec.runId);
    if (!existing || existing.recordedAt < rec.recordedAt) {
      latestByRun.set(rec.runId, rec);
    }
  }
  const self = new Map<string, number>();
  for (const run of phaseRuns) {
    const runIds = agentRunHistory[run.id] ?? (run.runId ? [run.runId] : []);
    let cost = 0;
    for (const rid of runIds) {
      const rec = latestByRun.get(rid);
      if (rec) {
        cost += rec.estimatedCostUsd;
      }
    }
    self.set(run.id, cost);
  }
  const childIds = new Map<string, string[]>();
  for (const run of phaseRuns) {
    if (run.parentAgentId == null) {
      continue;
    }
    const bucket = childIds.get(run.parentAgentId) ?? [];
    bucket.push(run.id);
    childIds.set(run.parentAgentId, bucket);
  }
  const rolled = new Map<string, number>();
  const rollup = (id: string): number => {
    const cached = rolled.get(id);
    if (cached != null) {
      return cached;
    }
    let total = self.get(id) ?? 0;
    for (const cid of childIds.get(id) ?? []) {
      total += rollup(cid);
    }
    rolled.set(id, total);
    return total;
  };
  for (const run of phaseRuns) {
    rollup(run.id);
  }
  return rolled;
};

const agentToNode = (
  agent: Agent,
  phaseRuns: ReadonlyArray<Agent>,
  costByAgentId: CostByAgentId,
  selectedAgentId: AgentId | null,
  depth: number,
): SpawnNode => {
  const children =
    depth < 6
      ? phaseRuns
          .filter((r) => r.parentAgentId === agent.id)
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((c) => agentToNode(c, phaseRuns, costByAgentId, selectedAgentId, depth + 1))
      : [];
  return {
    id: agent.id,
    name: agent.name,
    kind: kindOf(agent),
    status: statusToNodeStatus(agent.status),
    costUsd: costByAgentId.get(agent.id) ?? 0,
    outputSummary: agent.outputSummary ?? null,
    children,
    isSelected: agent.id === selectedAgentId,
  };
};

export const clusterLinksToNodes = (
  links: ReadonlyArray<InlineClusterLink>,
  selectedAgentId: AgentId | null,
  costByAgentId?: CostByAgentId,
): ReadonlyArray<SpawnNode> =>
  links.map((link, i) => {
    if (!link.agent) {
      return {
        id: `planned-${i}` as AgentId,
        name: link.title,
        kind: 'implementer' as AgentKind,
        status: 'planned',
        costUsd: 0,
        outputSummary: link.instructions,
        children: EMPTY_ARRAY as ReadonlyArray<SpawnNode>,
        isSelected: false,
      };
    }
    const agent = link.agent;
    return {
      id: agent.id,
      name: agent.name,
      kind: kindOf(agent),
      status: statusToNodeStatus(agent.status),
      costUsd: costByAgentId?.get(agent.id) ?? 0,
      outputSummary:
        agent.status === 'completed'
          ? (agent.outputSummary ?? link.instructions)
          : link.instructions,
      children: EMPTY_ARRAY as ReadonlyArray<SpawnNode>,
      isSelected: agent.id === selectedAgentId,
    };
  });

export const dashboardItemsToNodes = (
  items: ReadonlyArray<ClusterDashboardItem>,
  selectedAgentId: AgentId | null,
  costByAgentId?: CostByAgentId,
): ReadonlyArray<SpawnNode> =>
  items.map(({ agent, instructions }) => ({
    id: agent.id,
    name: agent.name,
    kind: kindOf(agent),
    status: statusToNodeStatus(agent.status),
    costUsd: costByAgentId?.get(agent.id) ?? 0,
    outputSummary:
      agent.status === 'completed' ? (agent.outputSummary ?? instructions) : instructions,
    children: EMPTY_ARRAY as ReadonlyArray<SpawnNode>,
    isSelected: agent.id === selectedAgentId,
  }));

export const useSpawnTree = (
  sessionId: SessionId,
  parentAgentId: AgentId | null,
  scope: 'inline' | 'dashboard',
): ReadonlyArray<SpawnNode> => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const sessionPlans = useAppStore((s) => s.sessionPlans[sessionId] ?? EMPTY_ARRAY);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const agentRunHistory = useAppStore((s) => s.agentRunHistory);

  return useMemo(() => {
    if (scope === 'dashboard') {
      const dashboard = selectClusterDashboard(
        phaseRuns,
        parentAgentId ?? selectedAgentId ?? undefined,
        sessionPlans,
      );
      if (!dashboard) {
        return EMPTY_ARRAY as ReadonlyArray<SpawnNode>;
      }
      const costByAgentId = buildCostByAgentId(phaseRuns, telemetry, agentRunHistory);
      return dashboard.items.map((item) =>
        agentToNode(item.agent, phaseRuns, costByAgentId, selectedAgentId, 0),
      );
    }
    return EMPTY_ARRAY as ReadonlyArray<SpawnNode>;
  }, [scope, phaseRuns, sessionPlans, selectedAgentId, parentAgentId, telemetry, agentRunHistory]);
};
