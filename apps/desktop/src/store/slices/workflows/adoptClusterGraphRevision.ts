import {
  adoptGraphRevision,
  extractClusterGraphRevision,
  presentationKeyForRole,
  type ClusterAdoptionProgress,
} from '@goodboy/core';
import type {
  Agent,
  AgentId,
  ClusterExecutionGraph,
  ClusterExecutionNode,
  ClusterGraphNode,
  SessionId,
} from '@goodboy/types';
import {
  invokeAgentList,
  invokeClusterGraphRevisionAdopt,
  invokeClusterGraphRevisionRefuse,
  type AgentInsertArgs,
} from '../../../features/workflows/workflows';
import { reserveGeneration } from '../agents/reserveGeneration';
import { childRoutingBatch } from './childRoutingBatch';
import { releasedSourceIds } from './releasedClusterSources';
import type { GetFn, SetFn } from './types';

export type GraphRevisionOutcome =
  | Readonly<{
      kind: 'adopted';
      revision: number;
      superseded: ReadonlyArray<string>;
      quarantined: ReadonlyArray<string>;
      appended: ReadonlyArray<string>;
    }>
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{ kind: 'unavailable'; reason: string }>;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerAgentId: AgentId;
  readonly obligationId: string | null;
  readonly proposalText: string;
  readonly reason: string;
};

const childrenOf = ({
  get,
  sessionId,
  containerAgentId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerAgentId: AgentId;
}): ReadonlyArray<Agent> =>
  (get().sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) => agent.parentAgentId === containerAgentId,
  );

const progressFor = ({
  graph,
  children,
  released,
}: {
  readonly graph: ClusterExecutionGraph;
  readonly children: ReadonlyArray<Agent>;
  readonly released: ReadonlySet<AgentId>;
}): ReadonlyArray<ClusterAdoptionProgress> =>
  graph.nodes.map((binding) => {
    const agent = children.find((child) => child.id === binding.agentId) ?? null;
    const isReleased = agent === null && binding.agentId !== null && released.has(binding.agentId);
    return {
      nodeId: binding.nodeId,
      isCompleted: isReleased || agent?.status === 'completed',
      isRunning: agent !== null && agent.status === 'running',
    };
  });

const rememberGraph = ({
  set,
  sessionId,
  graph,
}: {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly graph: ClusterExecutionGraph;
}): void => {
  set((state) => ({
    clusterExecutionGraphs: {
      ...(state.clusterExecutionGraphs ?? {}),
      [sessionId]: [
        ...(state.clusterExecutionGraphs?.[sessionId] ?? []).filter(
          (candidate) => candidate.containerAgentId !== graph.containerAgentId,
        ),
        graph,
      ],
    },
  }));
};

type RefuseParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly graph: ClusterExecutionGraph;
  readonly obligationId: string | null;
  readonly reason: string;
};

const refuse = async ({
  set,
  get,
  sessionId,
  graph,
  obligationId,
  reason,
}: RefuseParams): Promise<GraphRevisionOutcome> => {
  const stored = await invokeClusterGraphRevisionRefuse({
    id: `cluster-graph-revision:${graph.containerAgentId}:r${graph.revision}:refused:${crypto.randomUUID()}`,
    containerAgentId: graph.containerAgentId,
    obligationId,
    fromRevision: graph.revision,
    reason,
  });
  rememberGraph({ set, sessionId, graph: stored });
  void get().emitNotification(
    'error',
    'warning',
    'plan revision refused',
    `${reason}. the plan in flight stays frozen at revision ${graph.revision} and nothing was superseded.`,
    { sessionId },
  );
  return { kind: 'refused', reason };
};

const agentIdForNode = ({
  containerAgentId,
  revision,
  nodeId,
}: {
  readonly containerAgentId: AgentId;
  readonly revision: number;
  readonly nodeId: string;
}): AgentId => `${containerAgentId}:r${revision}:${nodeId}` as AgentId;

export const adoptClusterGraphRevision = async ({
  set,
  get,
  sessionId,
  containerAgentId,
  obligationId,
  proposalText,
  reason,
}: Params): Promise<GraphRevisionOutcome> => {
  const graph = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
    (candidate) => candidate.containerAgentId === containerAgentId,
  );
  if (graph === undefined) {
    return {
      kind: 'unavailable',
      reason: 'this execution consumed no graph, so there is nothing to revise',
    };
  }
  const extraction = extractClusterGraphRevision({ assistantText: proposalText });
  if (extraction.kind === 'none') {
    return refuse({
      set,
      get,
      sessionId,
      graph,
      obligationId,
      reason: 'the planner emitted no plan revision',
    });
  }
  if (extraction.kind === 'malformed') {
    return refuse({ set, get, sessionId, graph, obligationId, reason: extraction.reason });
  }
  const children = childrenOf({ get, sessionId, containerAgentId });
  const outcome = adoptGraphRevision({
    active: { revision: graph.revision, graph: graph.graph, nodes: graph.nodes },
    progress: progressFor({
      graph,
      children,
      released: releasedSourceIds({
        get,
        sessionId,
        containerId: containerAgentId,
        children,
        resolvingHoldId: null,
      }),
    }),
    proposal: extraction.proposal,
  });
  if (outcome.kind === 'refused') {
    return refuse({ set, get, sessionId, graph, obligationId, reason: outcome.reason });
  }

  const batch = childRoutingBatch({
    state: get(),
    sessionId,
    workflowRunId: graph.workflowRunId,
    role: 'implementer',
    requests: outcome.materialize.map((node: ClusterGraphNode) => ({
      proposal: null,
      promptText: `${node.title}\n${node.instructions}`,
      childLock: null,
      role: node.role,
    })),
  });
  if (batch.kind === 'blocked') {
    return refuse({ set, get, sessionId, graph, obligationId, reason: batch.reason });
  }
  const reservation = await reserveGeneration({
    get,
    sessionId,
    workflowRunId: graph.workflowRunId,
    parentAgentId: containerAgentId,
    creationPath: 'cluster',
    reservationKey: `${containerAgentId}:r${outcome.revision}`,
    count: outcome.materialize.length,
    ...(obligationId !== null && { obligationId }),
    label: 'the revised plan',
  });
  if (reservation.kind === 'refused') {
    return refuse({ set, get, sessionId, graph, obligationId, reason: reservation.reason });
  }

  const baseOrdinal =
    (get().sessionPhaseRuns[sessionId] ?? []).reduce((highest, agent) => {
      return agent.ordinal > highest ? agent.ordinal : highest;
    }, -1) + 1;
  const agentIdOf = new Map<string, AgentId>(
    outcome.materialize.map((node) => [
      node.id,
      agentIdForNode({ containerAgentId, revision: outcome.revision, nodeId: node.id }),
    ]),
  );
  const materializedIds = outcome.materialize.map(
    (node) => agentIdOf.get(node.id) ?? containerAgentId,
  );
  const agents: ReadonlyArray<AgentInsertArgs> = outcome.materialize.map((node, index) => {
    const fields = batch.entries[index]!;
    return {
      id: materializedIds[index]!,
      sessionId,
      parentAgentId: containerAgentId,
      ...(graph.workflowRunId !== null && { workflowRunId: graph.workflowRunId }),
      ordinal: baseOrdinal + index,
      name: node.title,
      status: 'pending',
      executionPurpose: 'cluster',
      kind: presentationKeyForRole({ role: node.role }),
      ...(fields.providerOverride !== null && { providerOverride: fields.providerOverride }),
      ...(fields.modelOverride !== null && { modelOverride: fields.modelOverride }),
      ...(fields.effort !== null && { effort: fields.effort }),
      ...(fields.routingLock !== null && { routingLock: fields.routingLock }),
      ...(fields.routingDecision !== null && { routingDecision: fields.routingDecision }),
      ...(fields.taskProfile !== null && { taskProfile: fields.taskProfile }),
      generationReservationId: reservation.reservations[index]!.reservationId,
    };
  });
  const nodes: ReadonlyArray<ClusterExecutionNode> = outcome.nodes.map((node) => ({
    ...node,
    agentId: agentIdOf.get(node.nodeId) ?? node.agentId,
  }));

  const adopted = await invokeClusterGraphRevisionAdopt({
    id: `cluster-graph-revision:${containerAgentId}:r${outcome.revision}`,
    containerAgentId,
    obligationId,
    fromRevision: graph.revision,
    toRevision: outcome.revision,
    executionVersion: outcome.graph.executionVersion,
    graphNodes: outcome.graph.nodes,
    reason,
    nodes,
    agents,
  });
  if (adopted.adopted === false) {
    rememberGraph({ set, sessionId, graph: adopted.graph });
    return refuse({
      set,
      get,
      sessionId,
      graph: adopted.graph,
      obligationId,
      reason: `the proposal was formed against revision ${graph.revision} and the execution is at revision ${adopted.graph.revision}`,
    });
  }
  const refreshed = await invokeAgentList(sessionId);
  rememberGraph({ set, sessionId, graph: adopted.graph });
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
    agentKindOverride: {
      ...state.agentKindOverride,
      ...Object.fromEntries(
        outcome.materialize.map((node, index) => [
          materializedIds[index],
          presentationKeyForRole({ role: node.role }),
        ]),
      ),
    },
  }));
  void get().refreshUnreadWorkspaces();
  return {
    kind: 'adopted',
    revision: outcome.revision,
    superseded: outcome.superseded.map((entry) => entry.nodeId),
    quarantined: outcome.quarantined,
    appended: outcome.materialize.map((node) => node.id),
  };
};
