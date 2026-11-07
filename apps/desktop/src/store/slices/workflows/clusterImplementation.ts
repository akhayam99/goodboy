import type {
  Agent,
  AgentId,
  HandoffDraft,
  ImplementationCluster,
  PlanWithCount,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { extractClusterDone, extractStuckMarker } from '@goodboy/core/context';
import { isAgentStatusSettled, notFinishedKindOf } from '@goodboy/core/workflows';
import {
  invokeAgentInsertBatch,
  invokeAgentList,
  invokeAgentUpdateStatus,
  type AgentInsertArgs,
} from '../../../features/workflows/workflows';
import { listConsumptionsForPlan as invokeListConsumptionsForPlan } from '../../../features/plans/plans';
import { composeKickoff, composeUnitBoundary } from '../turn/kickoff';
import { childRoutingBatch, type ChildRoutingFields } from './childRoutingBatch';
import { revalidateChildRouting } from './revalidateChildRouting';
import { SILENT_STUCK_REASON, continueOrPause, resetContinueAttempts } from './autoContinue';
import { skipDependentsOfStuck } from './clusterWaves/skipDependentsOfStuck';
import { startChild } from './clusterWaves/startChild';
import { holdForUserQuestion } from './holdForUserQuestion';
import type { GetFn, SetFn } from './types';
import { orderedChildAgentsOf } from '../../../shared/utils/orderedChildAgentsOf';
import { summarizeWorkflowAgentOutput } from './summarizeWorkflowAgentOutput';
import { blockUnreadablePart } from './clusterWaves/blockUnreadablePart';
import { clusterLaunching } from './clusterWaves/clusterLaunching';
import { clusterOrderBlocks } from './clusterWaves/clusterOrderBlocks';
import { launchableChildren } from './clusterWaves/launchableChildren';
import { composeClusterChecks } from './clusterWaves/composeClusterChecks';

const childrenIn = (runs: ReadonlyArray<Agent>, id: AgentId) =>
  orderedChildAgentsOf({ agents: runs, parentId: id });

export const clusterBoundaryMarker = (childId: AgentId): string =>
  `<<cluster-done id="${childId}">>`;

export const composeClusterBoundary = (childId: AgentId): string =>
  composeUnitBoundary({
    unit: 'cluster',
    marker: clusterBoundaryMarker(childId),
    stuckMarker: `<<cluster-stuck id="${childId}" reason="why it cannot finish">>`,
  });

function composeClusterKickoff(
  childId: AgentId,
  goalTitle: string,
  clusters: ReadonlyArray<ImplementationCluster>,
  index: number,
): string {
  const cluster = clusters[index];
  const { priorBlock, parallelBlock } = clusterOrderBlocks({ clusters, index });
  return composeKickoff(
    `**Goal** ${goalTitle}`,
    priorBlock,
    parallelBlock,
    `**Cluster ${index + 1}/${clusters.length}** ${cluster?.title ?? ''}`,
    cluster?.instructions ?? '',
    composeClusterChecks({ label: 'Done when', items: cluster?.doneWhen }),
    composeClusterChecks({ label: 'Touches', items: cluster?.touches }),
    composeClusterBoundary(childId),
  );
}

type ClusterHandoffParams = {
  readonly containerId: AgentId;
  readonly goalTitle: string;
  readonly clusters: ReadonlyArray<ImplementationCluster>;
  readonly index: number;
};

const clusterHandoff = ({
  containerId,
  goalTitle,
  clusters,
  index,
}: ClusterHandoffParams): HandoffDraft => {
  const cluster = clusters[index];
  return {
    sender: {
      kind: 'parent',
      parentAgentId: containerId,
      label: `cluster ${index + 1} of ${clusters.length}`,
    },
    instruction: composeKickoff(cluster?.title ?? '', cluster?.instructions ?? ''),
    goal: goalTitle,
  };
};

const hasInstructions = (cluster: ImplementationCluster | undefined): boolean =>
  (cluster?.instructions ?? '').trim().length > 0;

function composeContinuePrompt(
  childId: AgentId,
  cluster: ImplementationCluster | undefined,
): string {
  return composeKickoff(
    `**Resume**${cluster ? ` ${cluster.title}` : ''}: finish the remaining items now.`,
    composeClusterBoundary(childId),
  );
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
  if (childrenIn(existing, container.id).length > 0) {
    return;
  }

  const batch = childRoutingBatch({
    state: get(),
    sessionId,
    workflowRunId: container.workflowRunId ?? null,
    role: 'implementer',
    requests: clusters.map((cluster) => ({
      proposal: cluster.routingProposal ?? null,
      promptText: `${cluster.title}\n${cluster.instructions}`,
      childLock: null,
    })),
  });
  if (batch.kind === 'blocked') {
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `Subagent ${container.name} is blocked`,
      body: batch.reason,
      sessionId,
    });
    return;
  }

  const baseOrdinal =
    (get().sessionPhaseRuns[sessionId] ?? []).reduce((m, r) => Math.max(m, r.ordinal), -1) + 1;
  const materialized = await invokeAgentInsertBatch({
    parentAgentId: container.id,
    children: clusters.map((cluster, index): AgentInsertArgs => {
      const fields = batch.entries[index]!;
      return {
        sessionId,
        parentAgentId: container.id,
        ...(container.mountId != null && { mountId: container.mountId }),
        ...(container.workflowRunId != null && { workflowRunId: container.workflowRunId }),
        ordinal: baseOrdinal + index,
        name: cluster.title,
        status: 'pending',
        kind: 'implementer',
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
      agentTurnState[id] = { kind: 'idle', lastActivityAt: isoNow() };
      agentKindOverride[id] = 'implementer';
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
    return {
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      transcripts,
      agentTurnState,
      agentKindOverride,
      agentModelOverride,
      agentProviderOverride,
      agentEffortOverride,
    };
  });

  const children = childrenIn(materialized.agents, container.id);
  for (const child of launchableChildren({ children, clusters })) {
    const index = children.indexOf(child);
    clusterLaunching.claim({ childId: child.id });
    startChild({
      set,
      get,
      sessionId,
      containerId: container.id,
      childId: child.id,
      content: composeClusterKickoff(child.id, goalTitle, clusters, index),
      handoff: clusterHandoff({ containerId: container.id, goalTitle, clusters, index }),
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

export const unsettledClusterChildren = (
  runs: ReadonlyArray<Agent>,
  containerId: AgentId,
): ReadonlyArray<Agent> =>
  childrenIn(runs, containerId).filter((child) => !isAgentStatusSettled({ status: child.status }));

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
  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const children = childrenIn(runs, container.id);
  if (!children.some((child) => child.status === 'pending')) {
    return false;
  }
  const plan = await resolveClustersPlan({
    set,
    get,
    sessionId,
    containerId: container.id,
    workflowRunId: container.workflowRunId,
  });
  const clusters = plan?.clusters ?? [];
  const next = launchableChildren({ children, clusters })[0];
  if (next === undefined) {
    return false;
  }
  const index = children.indexOf(next);
  if (!hasInstructions(clusters[index])) {
    await blockUnreadablePart({ set, get, sessionId, child: next });
    return false;
  }
  const revalidated = await revalidateChildRouting({
    set,
    get,
    sessionId,
    child: next,
    role: 'implementer',
    promptText: `${next.name}\n${clusters[index]?.instructions ?? ''}`,
  });
  if (revalidated.kind === 'blocked') {
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `Subagent ${next.name} is blocked`,
      body: revalidated.reason,
      sessionId,
    });
    return false;
  }
  if (!clusterLaunching.claim({ childId: next.id })) {
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
    content: composeClusterKickoff(next.id, plan?.title ?? 'the plan', clusters, index),
    handoff: clusterHandoff({
      containerId: container.id,
      goalTitle: plan?.title ?? 'the plan',
      clusters,
      index,
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

export const advanceClusterImplementation = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    childAgentId: AgentId,
    assistantText: string,
    opts?: { readonly force?: boolean; readonly didAgentDie?: boolean },
  ) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const child = runs.find((r) => r.id === childAgentId);
    if (!child || !child.parentAgentId) {
      return;
    }
    const containerId = child.parentAgentId;
    const plan = await resolveClustersPlan({
      set,
      get,
      sessionId,
      containerId,
      workflowRunId: child.workflowRunId,
    });
    const clusters = plan?.clusters ?? [];
    const goalTitle = plan?.title ?? 'the plan';
    const found = childrenIn(runs, containerId).findIndex((c) => c.id === childAgentId);
    const index = Math.max(0, found);

    let justDoneId: AgentId | undefined = childAgentId;
    if (child.status === 'skipped' && opts?.force !== true) {
      return;
    }
    if (!opts?.force && !extractClusterDone(assistantText)) {
      if (await holdForUserQuestion({ set, get, sessionId, agent: child, assistantText })) {
        return;
      }
      const stuck = extractStuckMarker({ text: assistantText, kind: 'cluster' });
      const stuckReason = stuck !== null && stuck.id === childAgentId ? stuck.reason : null;
      const outcome = await continueOrPause({
        set,
        get,
        sessionId,
        agent: child,
        workflowRunId: child.workflowRunId,
        unit: 'cluster',
        didAgentDie: opts?.didAgentDie === true,
        hasStuckMarker: stuckReason !== null,
        restart: () =>
          startChild({
            set,
            get,
            sessionId,
            containerId,
            childId: childAgentId,
            content: composeContinuePrompt(childAgentId, clusters[index]),
          }),
      });
      if (outcome !== 'stuck') {
        return;
      }
      const siblings = childrenIn(runs, containerId);
      await invokeAgentUpdateStatus(childAgentId, {
        status: 'skipped',
        completedAt: isoNow(),
        outputSummary:
          stuckReason === null || stuckReason === '' ? SILENT_STUCK_REASON : stuckReason,
      });
      await skipDependentsOfStuck({ children: siblings, clusters, stuckIndex: index });
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: `${child.name} did not finish`,
        body: 'It was skipped so the run goes on. Open the agent to see why.',
        sessionId,
      });
      justDoneId = undefined;
    }
    if (justDoneId !== undefined) {
      resetContinueAttempts({ set, get, agentId: childAgentId });
      const outputSummary =
        assistantText.length > 0
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
        completedAt: isoNow(),
      });
    }
    let refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));

    const children = childrenIn(refreshed, containerId);
    const isDone = (c: Agent): boolean =>
      c.id === childAgentId || isAgentStatusSettled({ status: c.status });
    const settledCount = children.filter(isDone).length;
    const unfinishedCount = children.filter((c) => notFinishedKindOf({ agent: c }) !== null).length;
    const total = clusters.length > 0 ? clusters.length : children.length;

    if (settledCount >= total) {
      const container = refreshed.find((r) => r.id === containerId);
      if (container != null && !isAgentStatusSettled({ status: container.status })) {
        await invokeAgentUpdateStatus(containerId, {
          status: 'completed',
          outputSummary:
            unfinishedCount === 0
              ? `completed ${settledCount} clusters`
              : `completed ${settledCount - unfinishedCount} of ${settledCount} clusters`,
          completedAt: isoNow(),
        });
        refreshed = await invokeAgentList(sessionId);
        set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
      }
      void get().refreshUnreadWorkspaces();
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }

    const ready = launchableChildren({
      children,
      clusters,
      ...(justDoneId !== undefined && { justDoneId }),
    });
    const isWaiting = children.some((c) => !isDone(c));
    if (ready.length === 0 && isWaiting) {
      return;
    }
    if (ready.length === 0) {
      await invokeAgentUpdateStatus(containerId, { status: 'blocked', completedAt: isoNow() });
      const blocked = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: blocked } }));
      void get().refreshUnreadWorkspaces();
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'This subagent has no implementer',
        body: 'the resolved plan has more parts than this implementation has subagents, so the next one cannot start. open the plan and re-run the implementer.',
        sessionId,
      });
      return;
    }
    for (const next of ready) {
      const nextIndex = children.indexOf(next);
      if (!hasInstructions(clusters[nextIndex])) {
        await blockUnreadablePart({ set, get, sessionId, child: next });
        continue;
      }
      const revalidated = await revalidateChildRouting({
        set,
        get,
        sessionId,
        child: next,
        role: 'implementer',
        promptText: `${next.name}\n${clusters[nextIndex]?.instructions ?? ''}`,
      });
      if (revalidated.kind === 'blocked') {
        const held = await invokeAgentList(sessionId);
        set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: held } }));
        void get().emitNotification({
          kind: 'error',
          severity: 'warning',
          title: `Subagent ${next.name} is blocked`,
          body: revalidated.reason,
          sessionId,
        });
        continue;
      }
      if (!clusterLaunching.claim({ childId: next.id })) {
        continue;
      }
      void get().refreshUnreadWorkspaces();
      startChild({
        set,
        get,
        sessionId,
        containerId,
        childId: next.id,
        content: composeClusterKickoff(next.id, goalTitle, clusters, nextIndex),
        handoff: clusterHandoff({ containerId, goalTitle, clusters, index: nextIndex }),
      });
    }
  };
};
