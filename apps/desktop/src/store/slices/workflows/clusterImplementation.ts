import type {
  Agent,
  AgentId,
  ClusterCompletionFinding,
  ClusterCompletionHoldReason,
  ClusterExecutionNode,
  ClusterGraph,
  ClusterGraphNode,
  ImplementationCluster,
  IsoDateTime,
  PlanWithCount,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  extractClusterDone,
  extractClusterOutcome,
  normalizeClusterGraph,
  presentationKeyForRole,
  selectReadyClusterNode,
  type ClusterNodeProgress,
} from '@goodboy/core';
import {
  invokeAgentInsertBatch,
  invokeAgentList,
  invokeAgentUpdateStatus,
  invokeClusterCompletionHoldRecord,
  invokeClusterExecutionGraphRecord,
  type AgentInsertArgs,
} from '../../../features/workflows/workflows';
import { listConsumptionsForPlan as invokeListConsumptionsForPlan } from '../../../features/plans/plans';
import { composeClusterOutcomeBoundary, composeKickoff, composeUnitBoundary } from '../../kickoff';
import { childRoutingBatch, type ChildRoutingFields } from './childRoutingBatch';
import { revalidateChildRouting } from './revalidateChildRouting';
import { isHandsFree } from './handsFree';
import type { GetFn, SetFn } from './types';
import { summarizeWorkflowAgentOutput } from './summarizeWorkflowAgentOutput';

const MAX_CONTINUE = 1;

const MAX_START_ATTEMPTS = 3;

const MAX_STEP_START_ATTEMPTS = 6;

const START_BACKOFF_MS: ReadonlyArray<number> = [2_000, 8_000];

const DETERMINISTIC_START_FAILURES: ReadonlyArray<RegExp> = [
  /session not found/i,
  /no agent selected/i,
  /session directory not found/i,
  /resolved model args omit/i,
  /agent not found/i,
];

const continueAttempts = new Map<string, number>();

const childStartAttempts = new Map<string, number>();

const stepStartAttempts = new Map<string, number>();

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const isTransientStartFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return !DETERMINISTIC_START_FAILURES.some((pattern) => pattern.test(message));
};

const producedWork = (get: GetFn, childId: AgentId): boolean =>
  (get().transcripts[childId] ?? []).some(
    (event) => event.kind === 'assistant_text' || event.kind === 'tool_call_start',
  );

function childrenOf(runs: ReadonlyArray<Agent>, containerId: AgentId): ReadonlyArray<Agent> {
  return runs.filter((r) => r.parentAgentId === containerId).sort((a, b) => a.ordinal - b.ordinal);
}

export const clusterBoundaryMarker = (childId: AgentId): string =>
  `<<cluster-done id="${childId}">>`;

export const composeClusterBoundary = (childId: AgentId): string =>
  [
    composeUnitBoundary({ unit: 'cluster', marker: clusterBoundaryMarker(childId) }),
    composeClusterOutcomeBoundary({ agentId: childId }),
  ].join(' ');

type ClusterExecution = Readonly<{
  goalTitle: string;
  graph: ClusterGraph;
  bindings: ReadonlyArray<ClusterExecutionNode>;
}>;

type ClusterNodeSlot = Readonly<{
  agent: Agent | null;
  isReleased: boolean;
}>;

type ClusterNodePair = Readonly<{
  node: ClusterGraphNode;
  agent: Agent | null;
  isReleased: boolean;
}>;

const EMPTY_GRAPH: ClusterGraph = { executionVersion: 1, nodes: [] };

const NO_RELEASED_SOURCES: ReadonlySet<AgentId> = new Set();

const RELEASED_SLOT: ClusterNodeSlot = { agent: null, isReleased: true };

const orderedNodes = ({
  graph,
}: {
  readonly graph: ClusterGraph;
}): ReadonlyArray<ClusterGraphNode> =>
  [...graph.nodes].sort((left, right) => left.ordinal - right.ordinal);

type ReleasedSourceIdsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly children: ReadonlyArray<Agent>;
  readonly resolvingHoldId: string | null;
};

const releasedSourceIds = ({
  get,
  sessionId,
  containerId,
  children,
  resolvingHoldId,
}: ReleasedSourceIdsParams): ReadonlySet<AgentId> => {
  const childIds = new Set(children.map((child) => child.id));
  return new Set(
    (get().clusterCompletionHolds?.[sessionId] ?? [])
      .filter(
        (hold) =>
          hold.containerAgentId === containerId &&
          childIds.has(hold.sourceAgentId) === false &&
          (hold.state === 'resolved' || hold.id === resolvingHoldId),
      )
      .map((hold) => hold.sourceAgentId),
  );
};

const unboundSlots = ({
  children,
  releasedCount,
}: {
  readonly children: ReadonlyArray<Agent>;
  readonly releasedCount: number;
}): ReadonlyArray<ClusterNodeSlot> => {
  const firstUnsettled = children.findIndex((child) => isSettledChild(child) === false);
  const cut = firstUnsettled === -1 ? children.length : firstUnsettled;
  const toSlot = (agent: Agent): ClusterNodeSlot => ({ agent, isReleased: false });
  return [
    ...children.slice(0, cut).map(toSlot),
    ...Array.from({ length: releasedCount }, () => RELEASED_SLOT),
    ...children.slice(cut).map(toSlot),
  ];
};

const pairClusterNodes = ({
  execution,
  children,
  released,
}: {
  readonly execution: ClusterExecution;
  readonly children: ReadonlyArray<Agent>;
  readonly released: ReadonlySet<AgentId>;
}): ReadonlyArray<ClusterNodePair> => {
  const boundAgentId = new Map(
    execution.bindings.map((binding) => [binding.nodeId, binding.agentId]),
  );
  const boundIds = new Set(execution.bindings.map((binding) => binding.agentId));
  const slots = unboundSlots({
    children,
    releasedCount: [...released].filter((agentId) => boundIds.has(agentId) === false).length,
  });
  return orderedNodes({ graph: execution.graph }).map((node, index) => {
    const bound = boundAgentId.get(node.id) ?? null;
    if (bound === null) {
      const slot = slots[index] ?? null;
      return {
        node,
        agent: slot?.agent ?? null,
        isReleased: slot?.isReleased === true,
      };
    }
    const agent = children.find((child) => child.id === bound) ?? null;
    return { node, agent, isReleased: agent === null && released.has(bound) };
  });
};

const isCompletedPair = ({ pair }: { readonly pair: ClusterNodePair }): boolean =>
  pair.isReleased || pair.agent?.status === 'completed';

const clusterProgress = ({
  pairs,
}: {
  readonly pairs: ReadonlyArray<ClusterNodePair>;
}): ReadonlyArray<ClusterNodeProgress> =>
  pairs.map((pair) => ({
    nodeId: pair.node.id,
    isSettled: pair.isReleased || (pair.agent !== null && isSettledChild(pair.agent)),
    isCompleted: isCompletedPair({ pair }),
    isStartable:
      pair.isReleased === false && (pair.agent === null || pair.agent.status === 'pending'),
  }));

const nextClusterPair = ({
  execution,
  pairs,
  children,
}: {
  readonly execution: ClusterExecution;
  readonly pairs: ReadonlyArray<ClusterNodePair>;
  readonly children: ReadonlyArray<Agent>;
}): ClusterNodePair | null => {
  if (execution.graph.nodes.length === 0) {
    const fallback = children.find((child) => child.status === 'pending') ?? null;
    return fallback === null ? null : { node: UNREADABLE_NODE, agent: fallback, isReleased: false };
  }
  const ready = selectReadyClusterNode({
    graph: execution.graph,
    progress: clusterProgress({ pairs }),
  });
  if (ready === null) {
    return null;
  }
  return (
    pairs.find((pair) => pair.node.id === ready.id) ?? {
      node: ready,
      agent: null,
      isReleased: false,
    }
  );
};

const UNREADABLE_NODE: ClusterGraphNode = {
  id: 'unreadable',
  ordinal: 0,
  title: '',
  instructions: '',
  role: 'implementer',
  dependsOn: [],
  expectedOutput: null,
};

const hasInstructions = ({ node }: { readonly node: ClusterGraphNode }): boolean =>
  node.instructions.trim().length > 0;

const dependencyTitles = ({
  node,
  pairs,
}: {
  readonly node: ClusterGraphNode;
  readonly pairs: ReadonlyArray<ClusterNodePair>;
}): ReadonlyArray<string> =>
  node.dependsOn.flatMap((dependency) => {
    const match = pairs.find((pair) => pair.node.id === dependency);
    return match === undefined ? [] : [match.node.title];
  });

function composeClusterKickoff({
  childId,
  execution,
  pairs,
  target,
}: {
  readonly childId: AgentId;
  readonly execution: ClusterExecution;
  readonly pairs: ReadonlyArray<ClusterNodePair>;
  readonly target: ClusterGraphNode;
}): string {
  const total = pairs.length > 0 ? pairs.length : 1;
  const priorTitles = pairs
    .filter((pair) => pair.node.ordinal < target.ordinal && isCompletedPair({ pair }))
    .map((pair) => `${pair.node.ordinal + 1}. ${pair.node.title}`);
  const priorBlock =
    priorTitles.length > 0
      ? `**Done before you** ${priorTitles.join(', ')} (changes already on disk)`
      : '';
  const dependencies = dependencyTitles({ node: target, pairs });
  const dependencyBlock =
    execution.graph.executionVersion > 1 && dependencies.length > 0
      ? `**Depends on** ${dependencies.join(', ')}`
      : '';
  const roleBlock =
    target.role === 'implementer' ? '' : `**Role** ${target.role}: stay inside its boundaries.`;
  const expectedBlock =
    target.expectedOutput === null ? '' : `**Expected output** ${target.expectedOutput}`;
  return composeKickoff(
    `**Goal** ${execution.goalTitle}`,
    priorBlock,
    `**Cluster ${target.ordinal + 1}/${total}** ${target.title}`,
    roleBlock,
    dependencyBlock,
    expectedBlock,
    target.instructions,
    composeClusterBoundary(childId),
  );
}

function composeContinuePrompt(childId: AgentId, node: ClusterGraphNode | null): string {
  const title = node === null || node.title.length === 0 ? '' : ` ${node.title}`;
  return composeKickoff(
    `**Resume**${title}: finish the remaining items now.`,
    composeClusterBoundary(childId),
  );
}

type StartChildParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly childId: AgentId;
  readonly content: string;
};

const failChildStart = async ({
  set,
  get,
  sessionId,
  childId,
  reason,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly childId: AgentId;
  readonly reason: string;
}): Promise<void> => {
  const name =
    (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === childId)?.name ?? 'cluster';
  await invokeAgentUpdateStatus(childId, { status: 'failed', completedAt: nowIso() }).catch(
    () => undefined,
  );
  const refreshed = await invokeAgentList(sessionId).catch(() => null);
  if (refreshed != null) {
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  }
  void get().refreshUnreadWorkspaces();
  void get().emitNotification(
    'error',
    'warning',
    `cluster could not start: ${name}`,
    `${reason} open the agent and continue it manually. the step stays open until this cluster finishes.`,
    { sessionId },
  );
};

const handleChildStartFailure = async ({
  set,
  get,
  sessionId,
  containerId,
  childId,
  content,
  error,
}: StartChildParams & { readonly error: unknown }): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  const failures = (childStartAttempts.get(childId) ?? 0) + 1;
  const stepFailures = (stepStartAttempts.get(containerId) ?? 0) + 1;
  childStartAttempts.set(childId, failures);
  stepStartAttempts.set(containerId, stepFailures);

  if (producedWork(get, childId) || !isTransientStartFailure(error)) {
    await failChildStart({ set, get, sessionId, childId, reason: `${message}.` });
    return;
  }
  if (failures >= MAX_START_ATTEMPTS || stepFailures >= MAX_STEP_START_ATTEMPTS) {
    await failChildStart({
      set,
      get,
      sessionId,
      childId,
      reason: `${message}. it failed to start ${failures} ${failures === 1 ? 'time' : 'times'}.`,
    });
    return;
  }

  const delayMs = START_BACKOFF_MS[failures - 1] ?? START_BACKOFF_MS[START_BACKOFF_MS.length - 1]!;
  setTimeout(() => {
    const child = (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === childId);
    if (child != null && (child.status === 'completed' || child.status === 'skipped')) {
      return;
    }
    const turn = get().agentTurnState[childId];
    if (turn?.kind === 'running' || turn?.kind === 'starting') {
      return;
    }
    startChild({ set, get, sessionId, containerId, childId, content });
  }, delayMs);
};

function startChild({
  set,
  get,
  sessionId,
  containerId,
  childId,
  content,
}: StartChildParams): void {
  const attempt = (childStartAttempts.get(childId) ?? 0) + 1;
  set((s) => ({
    agentTurnState: {
      ...s.agentTurnState,
      [childId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
    },
    clusterStartAttempts: { ...s.clusterStartAttempts, [childId]: attempt },
  }));
  void get()
    .sendTurn({ sessionId, agentId: childId, content, origin: 'workflow' })
    .catch((error: unknown) => {
      void handleChildStartFailure({
        set,
        get,
        sessionId,
        containerId,
        childId,
        content,
        error,
      });
    });
}

type ClusterContainerParams = {
  readonly container: Agent;
};

export const canFanOutClusters = ({ container }: ClusterContainerParams): boolean =>
  container.parentAgentId == null;

export const fanOutClusters = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  container: Agent,
  clusters: ReadonlyArray<ImplementationCluster>,
  goalTitle: string,
): Promise<void> => {
  if (canFanOutClusters({ container }) === false) {
    return;
  }
  const existing = get().sessionPhaseRuns[sessionId] ?? [];
  if (childrenOf(existing, container.id).length > 0) {
    return;
  }

  const normalized = normalizeClusterGraph({ clusters });
  if (normalized.kind === 'invalid') {
    void get().emitNotification(
      'error',
      'warning',
      `cluster blocked: ${container.name}`,
      `the plan clusters are not a valid graph: ${normalized.reason}`,
      { sessionId },
    );
    return;
  }
  const nodes = orderedNodes({ graph: normalized.graph });

  const batch = childRoutingBatch({
    state: get(),
    sessionId,
    workflowRunId: container.workflowRunId ?? null,
    role: 'implementer',
    requests: nodes.map((node, index) => ({
      proposal: clusters[index]?.routingProposal ?? null,
      promptText: `${node.title}\n${node.instructions}`,
      childLock: null,
      role: node.role,
    })),
  });
  if (batch.kind === 'blocked') {
    void get().emitNotification(
      'error',
      'warning',
      `cluster blocked: ${container.name}`,
      batch.reason,
      { sessionId },
    );
    return;
  }

  const baseOrdinal =
    (get().sessionPhaseRuns[sessionId] ?? []).reduce((m, r) => Math.max(m, r.ordinal), -1) + 1;
  const materialized = await invokeAgentInsertBatch({
    parentAgentId: container.id,
    children: nodes.map((node, index): AgentInsertArgs => {
      const fields = batch.entries[index]!;
      return {
        sessionId,
        parentAgentId: container.id,
        ...(container.workflowRunId != null && { workflowRunId: container.workflowRunId }),
        ordinal: baseOrdinal + index,
        name: node.title,
        status: 'pending',
        kind: presentationKeyForRole({ role: node.role }),
        ...(fields.providerOverride !== null && { providerOverride: fields.providerOverride }),
        ...(fields.modelOverride !== null && { modelOverride: fields.modelOverride }),
        ...(fields.effort !== null && { effort: fields.effort }),
        ...(fields.routingLock !== null && { routingLock: fields.routingLock }),
        ...(fields.routingDecision !== null && { routingDecision: fields.routingDecision }),
        ...(fields.taskProfile !== null && { taskProfile: fields.taskProfile }),
      };
    }),
  });
  if (materialized.inserted === false) {
    return;
  }
  const childIds: AgentId[] = materialized.agents.map((agent) => agent.id);

  const bindings: ReadonlyArray<ClusterExecutionNode> = nodes.map((node, index) => ({
    nodeId: node.id,
    agentId: childIds[index] ?? null,
    ordinal: node.ordinal,
    role: node.role,
  }));
  const snapshot = await invokeClusterExecutionGraphRecord({
    containerAgentId: container.id,
    sessionId,
    workflowRunId: container.workflowRunId ?? null,
    planId:
      selectClustersPlan(get().sessionPlans[sessionId] ?? [], container.workflowRunId)?.id ?? null,
    goalTitle,
    executionVersion: normalized.graph.executionVersion,
    graphNodes: nodes,
    nodes: bindings,
  });

  await invokeAgentUpdateStatus(container.id, { status: 'running' });

  const refreshed = await invokeAgentList(sessionId);
  set((s) => {
    const transcripts = { ...s.transcripts };
    const agentTurnState = { ...s.agentTurnState };
    const agentKindOverride = { ...s.agentKindOverride };
    const agentModelOverride = { ...s.agentModelOverride };
    const agentProviderOverride = { ...s.agentProviderOverride };
    const agentEffortOverride = { ...s.agentEffortOverride };
    for (let i = 0; i < childIds.length; i++) {
      const id = childIds[i]!;
      const fields: ChildRoutingFields = batch.entries[i]!;
      transcripts[id] = transcripts[id] ?? [];
      agentTurnState[id] = { kind: 'idle', lastActivityAt: nowIso() };
      agentKindOverride[id] = presentationKeyForRole({ role: nodes[i]!.role });
      if (fields.modelOverride !== null) {
        agentModelOverride[id] = fields.modelOverride;
      }
      if (fields.providerOverride !== null) {
        agentProviderOverride[id] = fields.providerOverride;
      }
      if (fields.effort !== null) {
        agentEffortOverride[id] = fields.effort;
      }
    }
    const sessionGraphs = (s.clusterExecutionGraphs?.[sessionId] ?? []).filter(
      (graph) => graph.containerAgentId !== container.id,
    );
    return {
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      clusterExecutionGraphs: {
        ...(s.clusterExecutionGraphs ?? {}),
        [sessionId]: [...sessionGraphs, snapshot],
      },
      transcripts,
      agentTurnState,
      agentKindOverride,
      agentModelOverride,
      agentProviderOverride,
      agentEffortOverride,
    };
  });

  const execution: ClusterExecution = {
    goalTitle,
    graph: snapshot.graph,
    bindings: snapshot.nodes,
  };
  const children = materialized.agents;
  const pairs = pairClusterNodes({ execution, children, released: NO_RELEASED_SOURCES });
  const first = nextClusterPair({ execution, pairs, children });
  if (first?.agent != null) {
    startChild({
      set,
      get,
      sessionId,
      containerId: container.id,
      childId: first.agent.id,
      content: composeClusterKickoff({
        childId: first.agent.id,
        execution,
        pairs,
        target: first.node,
      }),
    });
  }
};

export const selectClustersPlan = (
  plans: ReadonlyArray<PlanWithCount>,
  workflowRunId?: WorkflowRunId | undefined,
): PlanWithCount | null => {
  const target = workflowRunId ?? undefined;
  for (let i = plans.length - 1; i >= 0; i--) {
    const p = plans[i];
    if (!p?.clusters || p.clusters.length < 2) {
      continue;
    }
    if ((p.workflowRunId ?? undefined) !== target) {
      continue;
    }
    return p;
  }
  return null;
};

function findClustersPlan(
  get: GetFn,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId | undefined,
) {
  const p = selectClustersPlan(get().sessionPlans[sessionId] ?? [], workflowRunId);
  return p?.status === 'active' ? p : null;
}

type FindConsumedClustersPlanParams = {
  readonly get: GetFn;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly containerId: AgentId;
};

const findConsumedClustersPlan = ({
  get,
  plans,
  containerId,
}: FindConsumedClustersPlanParams): PlanWithCount | null => {
  const consumptionsByPlan = get().planConsumptions;
  for (let i = plans.length - 1; i >= 0; i--) {
    const plan = plans[i];
    if (!plan?.clusters || plan.clusters.length < 2) {
      continue;
    }
    if ((consumptionsByPlan[plan.id] ?? []).some((item) => item.agentId === containerId)) {
      return plan;
    }
  }
  return null;
};

type HydrateClusterPlanConsumptionsParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly plans: ReadonlyArray<PlanWithCount>;
};

const hydrateClusterPlanConsumptions = async ({
  set,
  get,
  plans,
}: HydrateClusterPlanConsumptionsParams): Promise<void> => {
  const consumptionsByPlan = get().planConsumptions;
  const missingPlans = plans.filter(
    (plan) =>
      plan.clusters != null &&
      plan.clusters.length >= 2 &&
      !Object.prototype.hasOwnProperty.call(consumptionsByPlan, plan.id),
  );
  if (missingPlans.length === 0) {
    return;
  }
  const entries = await Promise.all(
    missingPlans.map(async (plan) => {
      const consumptions = await invokeListConsumptionsForPlan(plan.id);
      return [plan.id, consumptions] as const;
    }),
  );
  set((state) => ({
    planConsumptions: {
      ...state.planConsumptions,
      ...Object.fromEntries(entries),
    },
  }));
};

type ResolveClustersPlanParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly workflowRunId: WorkflowRunId | undefined;
};

const resolveClustersPlan = async ({
  set,
  get,
  sessionId,
  containerId,
  workflowRunId,
}: ResolveClustersPlanParams): Promise<PlanWithCount | null> => {
  let plans = get().sessionPlans[sessionId] ?? [];
  let consumedPlan = findConsumedClustersPlan({ get, plans, containerId });
  if (consumedPlan != null) {
    return consumedPlan;
  }
  await hydrateClusterPlanConsumptions({ set, get, plans }).catch(() => undefined);
  consumedPlan = findConsumedClustersPlan({ get, plans, containerId });
  if (consumedPlan != null) {
    return consumedPlan;
  }
  const matchingPlan = selectClustersPlan(plans, workflowRunId);
  if (matchingPlan != null) {
    return matchingPlan;
  }
  await get()
    .loadSessionPlans(sessionId)
    .catch(() => undefined);
  plans = get().sessionPlans[sessionId] ?? [];
  consumedPlan = findConsumedClustersPlan({ get, plans, containerId });
  if (consumedPlan != null) {
    return consumedPlan;
  }
  await hydrateClusterPlanConsumptions({ set, get, plans }).catch(() => undefined);
  consumedPlan = findConsumedClustersPlan({ get, plans, containerId });
  if (consumedPlan != null) {
    return consumedPlan;
  }
  return selectClustersPlan(plans, workflowRunId);
};

const isSettledChild = (agent: Agent): boolean =>
  agent.status === 'completed' || agent.status === 'skipped';

const resolveClusterExecution = async ({
  set,
  get,
  sessionId,
  containerId,
  workflowRunId,
}: ResolveClustersPlanParams): Promise<ClusterExecution> => {
  const snapshot = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
    (graph) => graph.containerAgentId === containerId,
  );
  if (snapshot !== undefined) {
    return {
      goalTitle: snapshot.goalTitle,
      graph: snapshot.graph,
      bindings: snapshot.nodes,
    };
  }
  const plan = await resolveClustersPlan({ set, get, sessionId, containerId, workflowRunId });
  const goalTitle = plan?.title ?? 'the plan';
  const clusters = plan?.clusters ?? [];
  if (clusters.length === 0) {
    return { goalTitle, graph: EMPTY_GRAPH, bindings: [] };
  }
  const normalized = normalizeClusterGraph({ clusters });
  if (normalized.kind === 'invalid') {
    return { goalTitle, graph: EMPTY_GRAPH, bindings: [] };
  }
  return { goalTitle, graph: normalized.graph, bindings: [] };
};

export const unsettledClusterChildren = (
  runs: ReadonlyArray<Agent>,
  containerId: AgentId,
): ReadonlyArray<Agent> => childrenOf(runs, containerId).filter((child) => !isSettledChild(child));

type ResumeClusterChildrenParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly container: Agent;
};

export const resumeClusterChildren = async ({
  set,
  get,
  sessionId,
  container,
}: ResumeClusterChildrenParams): Promise<boolean> => {
  if (
    (get().clusterCompletionHolds?.[sessionId] ?? []).some(
      (hold) => hold.containerAgentId === container.id && hold.state === 'open',
    )
  ) {
    return false;
  }
  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const children = childrenOf(runs, container.id);
  const isInFlight = children.some(
    (child) => isSettledChild(child) === false && child.status !== 'pending',
  );
  if (isInFlight === true) {
    return false;
  }
  const execution = await resolveClusterExecution({
    set,
    get,
    sessionId,
    containerId: container.id,
    workflowRunId: container.workflowRunId,
  });
  const pairs = pairClusterNodes({
    execution,
    children,
    released: releasedSourceIds({
      get,
      sessionId,
      containerId: container.id,
      children,
      resolvingHoldId: null,
    }),
  });
  const target = nextClusterPair({ execution, pairs, children });
  const next = target?.agent ?? null;
  if (target === null || next === null) {
    return false;
  }
  if (hasInstructions({ node: target.node }) === false) {
    await invokeAgentUpdateStatus(next.id, { status: 'failed', completedAt: nowIso() });
    const blocked = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: blocked } }));
    void get().refreshUnreadWorkspaces();
    void get().emitNotification(
      'error',
      'warning',
      `cluster blocked: ${next.name}`,
      'the plan that defines this cluster is no longer readable, so there are no instructions to send. open the plan and re-run the implementer.',
      { sessionId },
    );
    return false;
  }
  const revalidated = await revalidateChildRouting({
    set,
    get,
    sessionId,
    child: next,
    role: target.node.role,
    promptText: `${next.name}\n${target.node.instructions}`,
  });
  if (revalidated.kind === 'blocked') {
    void get().emitNotification(
      'error',
      'warning',
      `cluster blocked: ${next.name}`,
      revalidated.reason,
      { sessionId },
    );
    return false;
  }
  await invokeAgentUpdateStatus(container.id, { status: 'running' });
  const refreshed = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  startChild({
    set,
    get,
    sessionId,
    containerId: container.id,
    childId: next.id,
    content: composeClusterKickoff({
      childId: next.id,
      execution,
      pairs,
      target: target.node,
    }),
  });
  return true;
};

export const selectFanOutPlan = (
  get: GetFn,
  sessionId: SessionId,
  opts: {
    readonly workflowRunId?: WorkflowRunId | undefined;
    readonly explicitPlan?: PlanWithCount | null | undefined;
  },
): PlanWithCount | null => {
  if (opts.explicitPlan?.clusters && opts.explicitPlan.clusters.length >= 2) {
    return opts.explicitPlan;
  }
  return findClustersPlan(get, sessionId, opts.workflowRunId);
};

type OpenCompletionHoldForContainerParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly ignoredHoldId: string | null;
};

const openCompletionHoldForContainer = ({
  get,
  sessionId,
  containerId,
  ignoredHoldId,
}: OpenCompletionHoldForContainerParams) =>
  (get().clusterCompletionHolds?.[sessionId] ?? []).find(
    (hold) =>
      hold.containerAgentId === containerId && hold.state === 'open' && hold.id !== ignoredHoldId,
  ) ?? null;

const sourceTurnIdForChild = ({
  get,
  child,
}: {
  readonly get: GetFn;
  readonly child: Agent;
}): string => {
  if (child.runId != null) {
    return child.runId;
  }
  const events = get().transcripts[child.id] ?? [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === 'assistant_text') {
      return event.runId;
    }
  }
  return `unidentified-turn:${child.id}`;
};

type PersistCompletionHoldParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly child: Agent;
  readonly containerId: AgentId;
  readonly assistantText: string;
  readonly reason: ClusterCompletionHoldReason;
  readonly findings: ReadonlyArray<ClusterCompletionFinding>;
};

const completionHoldMessage = ({
  reason,
  findings,
}: {
  readonly reason: ClusterCompletionHoldReason;
  readonly findings: ReadonlyArray<ClusterCompletionFinding>;
}): string => {
  if (reason === 'unresolved-outcome') {
    return findings.map((finding) => `${finding.reason} (${finding.target})`).join('; ');
  }
  if (reason === 'missing-outcome') {
    return 'the agent emitted the cluster boundary without a completion outcome. inspect its output, then resolve the hold explicitly.';
  }
  if (reason === 'malformed-outcome') {
    return 'the agent emitted a malformed completion outcome. inspect its output, then resolve the hold explicitly.';
  }
  return 'the completion outcome belongs to another agent. inspect its output, then resolve the hold explicitly.';
};

const persistCompletionHold = async ({
  set,
  get,
  sessionId,
  child,
  containerId,
  assistantText,
  reason,
  findings,
}: PersistCompletionHoldParams): Promise<void> => {
  const sourceTurnId = sourceTurnIdForChild({ get, child });
  const existing = (get().clusterCompletionHolds?.[sessionId] ?? []).find(
    (hold) => hold.sourceAgentId === child.id && hold.sourceTurnId === sourceTurnId,
  );
  if (existing !== undefined) {
    return;
  }
  const outputSummary =
    assistantText.length > 0
      ? await summarizeWorkflowAgentOutput({
          set,
          get,
          sessionId,
          agent: child,
          output: assistantText,
        })
      : 'cluster held for explicit resolution';
  const hold = await invokeClusterCompletionHoldRecord({
    id: `cluster-completion:${child.id}:${sourceTurnId}`,
    sessionId,
    workflowRunId: child.workflowRunId ?? null,
    containerAgentId: containerId,
    sourceAgentId: child.id,
    sourceTurnId,
    reason,
    findings,
  });
  await invokeAgentUpdateStatus(child.id, {
    status: 'failed',
    outputSummary,
    completedAt: nowIso(),
  });
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
    clusterCompletionHolds: {
      ...(state.clusterCompletionHolds ?? {}),
      [sessionId]: [...(state.clusterCompletionHolds?.[sessionId] ?? []), hold],
    },
  }));
  void get().refreshUnreadWorkspaces();
  void get().emitNotification(
    'error',
    'warning',
    `cluster held: ${child.name}`,
    completionHoldMessage({ reason, findings }),
    { sessionId },
  );
};

export const advanceClusterImplementation = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    childAgentId: AgentId,
    assistantText: string,
    opts?: { readonly force?: boolean; readonly resolvedHoldId?: string },
  ) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const resolvedHold =
      opts?.resolvedHoldId === undefined
        ? null
        : ((get().clusterCompletionHolds?.[sessionId] ?? []).find(
            (hold) =>
              hold.id === opts.resolvedHoldId &&
              hold.sourceAgentId === childAgentId &&
              (hold.state === 'open' || hold.state === 'resolved'),
          ) ?? null);
    const isExplicitResolution = opts?.force === true && resolvedHold !== null;
    const child = runs.find((run) => run.id === childAgentId);
    if (child === undefined && !isExplicitResolution) {
      return;
    }
    if (child !== undefined && child.parentAgentId === undefined) {
      return;
    }
    const containerId = child?.parentAgentId ?? resolvedHold?.containerAgentId;
    if (containerId === undefined) {
      return;
    }
    const execution = await resolveClusterExecution({
      set,
      get,
      sessionId,
      containerId,
      workflowRunId: child?.workflowRunId ?? resolvedHold?.workflowRunId ?? undefined,
    });
    const currentChildren = childrenOf(runs, containerId);
    const currentPairs = pairClusterNodes({
      execution,
      children: currentChildren,
      released: releasedSourceIds({
        get,
        sessionId,
        containerId,
        children: currentChildren,
        resolvingHoldId: resolvedHold?.id ?? null,
      }),
    });
    const currentNode = currentPairs.find((pair) => pair.agent?.id === childAgentId)?.node ?? null;

    const doneMarker = extractClusterDone(assistantText);
    if (child !== undefined && opts?.force !== true && doneMarker?.id !== childAgentId) {
      const handsFree = isHandsFree(get, sessionId, child.workflowRunId);
      const attempts = continueAttempts.get(childAgentId) ?? 0;
      if (handsFree && attempts < MAX_CONTINUE) {
        continueAttempts.set(childAgentId, attempts + 1);
        startChild({
          set,
          get,
          sessionId,
          containerId,
          childId: childAgentId,
          content: composeContinuePrompt(childAgentId, currentNode),
        });
      } else {
        continueAttempts.delete(childAgentId);
        await invokeAgentUpdateStatus(childAgentId, { status: 'failed', completedAt: nowIso() });
        const stalled = await invokeAgentList(sessionId);
        set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: stalled } }));
        void get().refreshUnreadWorkspaces();
        void get().emitNotification(
          'error',
          'warning',
          `cluster paused: ${child.name}`,
          handsFree
            ? 'the implementer stopped before completing this cluster. open the agent and continue manually.'
            : 'autorun is off, so this cluster will not continue on its own. open the agent and continue manually, or enable autorun.',
          { sessionId },
        );
      }
      return;
    }

    if (!isExplicitResolution) {
      if (child === undefined) {
        return;
      }
      const extraction = extractClusterOutcome({ assistantText });
      const reason: ClusterCompletionHoldReason | null =
        extraction.kind === 'missing'
          ? 'missing-outcome'
          : extraction.kind === 'malformed'
            ? 'malformed-outcome'
            : extraction.outcome.id !== childAgentId
              ? 'foreign-outcome'
              : extraction.outcome.status === 'unresolved'
                ? 'unresolved-outcome'
                : null;
      if (reason !== null) {
        const findings =
          extraction.kind === 'valid' && extraction.outcome.status === 'unresolved'
            ? extraction.outcome.findings
            : [];
        await persistCompletionHold({
          set,
          get,
          sessionId,
          child,
          containerId,
          assistantText,
          reason,
          findings,
        });
        return;
      }
      if (
        openCompletionHoldForContainer({
          get,
          sessionId,
          containerId,
          ignoredHoldId: null,
        }) !== null
      ) {
        return;
      }
    }

    continueAttempts.delete(childAgentId);
    const outputSummary =
      child !== undefined && assistantText.length > 0
        ? await summarizeWorkflowAgentOutput({
            set,
            get,
            sessionId,
            agent: child,
            output: assistantText,
          })
        : 'advanced to next cluster manually';
    await invokeAgentUpdateStatus(childAgentId, {
      status: 'completed',
      outputSummary,
      completedAt: nowIso(),
    });
    let refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));

    const children = childrenOf(refreshed, containerId);
    const completedCount = children.filter((c) => c.status === 'completed').length;
    const released = releasedSourceIds({
      get,
      sessionId,
      containerId,
      children,
      resolvingHoldId: resolvedHold?.id ?? null,
    });
    const pairs = pairClusterNodes({ execution, children, released });
    const completedProgress = completedCount + released.size;
    const total =
      execution.graph.nodes.length > 0
        ? execution.graph.nodes.length
        : children.length + released.size;

    if (
      completedProgress >= total &&
      openCompletionHoldForContainer({
        get,
        sessionId,
        containerId,
        ignoredHoldId: isExplicitResolution ? resolvedHold.id : null,
      }) === null
    ) {
      await invokeAgentUpdateStatus(containerId, {
        status: 'completed',
        outputSummary: `completed ${completedProgress} clusters`,
        completedAt: nowIso(),
      });
      refreshed = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
      void get().refreshUnreadWorkspaces();
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }

    if (
      openCompletionHoldForContainer({
        get,
        sessionId,
        containerId,
        ignoredHoldId: isExplicitResolution ? resolvedHold.id : null,
      }) !== null
    ) {
      return;
    }

    const target = nextClusterPair({ execution, pairs, children });
    if (target === null) {
      const waiting = pairs.filter(
        (pair) => pair.agent !== null && isSettledChild(pair.agent) === false,
      );
      if (waiting.length === 0) {
        return;
      }
      void get().emitNotification(
        'error',
        'warning',
        `cluster blocked: ${waiting[0]!.node.title}`,
        'every remaining cluster waits on a dependency that did not complete. resolve the failed cluster, then continue this implementation.',
        { sessionId },
      );
      return;
    }
    const next = target.agent;
    if (next === null) {
      await invokeAgentUpdateStatus(containerId, { status: 'failed', completedAt: nowIso() });
      const blocked = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: blocked } }));
      void get().refreshUnreadWorkspaces();
      void get().emitNotification(
        'error',
        'warning',
        'cluster blocked: missing implementer',
        'the resolved plan has more clusters than this implementation contains, so the next cluster cannot start. open the plan and re-run the implementer.',
        { sessionId },
      );
      return;
    }
    if (hasInstructions({ node: target.node }) === false) {
      await invokeAgentUpdateStatus(next.id, { status: 'failed', completedAt: nowIso() });
      const blocked = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: blocked } }));
      void get().refreshUnreadWorkspaces();
      void get().emitNotification(
        'error',
        'warning',
        `cluster blocked: ${next.name}`,
        'the plan that defines this cluster is no longer readable, so there are no instructions to send. open the plan and re-run the implementer.',
        { sessionId },
      );
      return;
    }
    const revalidated = await revalidateChildRouting({
      set,
      get,
      sessionId,
      child: next,
      role: target.node.role,
      promptText: `${next.name}\n${target.node.instructions}`,
    });
    if (revalidated.kind === 'blocked') {
      const held = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: held } }));
      void get().emitNotification(
        'error',
        'warning',
        `cluster blocked: ${next.name}`,
        revalidated.reason,
        { sessionId },
      );
      return;
    }
    void get().refreshUnreadWorkspaces();
    startChild({
      set,
      get,
      sessionId,
      containerId,
      childId: next.id,
      content: composeClusterKickoff({
        childId: next.id,
        execution,
        pairs,
        target: target.node,
      }),
    });
  };
};
