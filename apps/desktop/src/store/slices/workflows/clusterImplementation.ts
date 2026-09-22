import type {
  Agent,
  AgentId,
  ClusterCompletionFinding,
  ClusterCompletionHoldReason,
  ImplementationCluster,
  IsoDateTime,
  PlanWithCount,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { extractClusterDone, extractClusterOutcome } from '@goodboy/core';
import {
  invokeAgentInsertBatch,
  invokeAgentList,
  invokeAgentUpdateStatus,
  invokeClusterCompletionHoldRecord,
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

function composeClusterKickoff(
  childId: AgentId,
  goalTitle: string,
  clusters: ReadonlyArray<ImplementationCluster>,
  index: number,
): string {
  const cluster = clusters[index];
  const priorTitles = clusters.slice(0, index).map((c, i) => `${i + 1}. ${c.title}`);
  const priorBlock =
    priorTitles.length > 0
      ? `**Done before you** ${priorTitles.join(', ')} (changes already on disk)`
      : '';
  return composeKickoff(
    `**Goal** ${goalTitle}`,
    priorBlock,
    `**Cluster ${index + 1}/${clusters.length}** ${cluster?.title ?? ''}`,
    cluster?.instructions ?? '',
    composeClusterBoundary(childId),
  );
}

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
    children: clusters.map((cluster, index): AgentInsertArgs => {
      const fields = batch.entries[index]!;
      return {
        sessionId,
        parentAgentId: container.id,
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
      agentTurnState[id] = { kind: 'idle', lastActivityAt: nowIso() };
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

  const first = childIds[0];
  if (first) {
    startChild({
      set,
      get,
      sessionId,
      containerId: container.id,
      childId: first,
      content: composeClusterKickoff(first, goalTitle, clusters, 0),
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
  const next = children.find((child) => !isSettledChild(child));
  if (next == null || next.status !== 'pending') {
    return false;
  }
  const index = children.indexOf(next);
  const plan = await resolveClustersPlan({
    set,
    get,
    sessionId,
    containerId: container.id,
    workflowRunId: container.workflowRunId,
  });
  const clusters = plan?.clusters ?? [];
  if (!hasInstructions(clusters[index])) {
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
    role: 'implementer',
    promptText: `${next.name}\n${clusters[index]?.instructions ?? ''}`,
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
    content: composeClusterKickoff(next.id, plan?.title ?? 'the plan', clusters, index),
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

const openCompletionHoldForContainer = ({
  get,
  sessionId,
  containerId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
}) =>
  (get().clusterCompletionHolds?.[sessionId] ?? []).find(
    (hold) => hold.containerAgentId === containerId && hold.state === 'open',
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
    const index = Math.max(
      0,
      childrenOf(runs, containerId).findIndex((c) => c.id === childAgentId),
    );

    const doneMarker = extractClusterDone(assistantText);
    if (opts?.force !== true && doneMarker?.id !== childAgentId) {
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
          content: composeContinuePrompt(childAgentId, clusters[index]),
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

    const resolvedHold =
      opts?.resolvedHoldId === undefined
        ? null
        : ((get().clusterCompletionHolds?.[sessionId] ?? []).find(
            (hold) =>
              hold.id === opts.resolvedHoldId &&
              hold.sourceAgentId === childAgentId &&
              hold.state === 'resolved',
          ) ?? null);
    const isExplicitResolution = opts?.force === true && resolvedHold !== null;
    if (!isExplicitResolution) {
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
      if (openCompletionHoldForContainer({ get, sessionId, containerId }) !== null) {
        return;
      }
    }

    continueAttempts.delete(childAgentId);
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
      completedAt: nowIso(),
    });
    let refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));

    const children = childrenOf(refreshed, containerId);
    const completedCount = children.filter((c) => c.status === 'completed').length;
    const total = clusters.length > 0 ? clusters.length : children.length;

    if (
      completedCount >= total &&
      openCompletionHoldForContainer({ get, sessionId, containerId }) === null
    ) {
      await invokeAgentUpdateStatus(containerId, {
        status: 'completed',
        outputSummary: `completed ${completedCount} clusters`,
        completedAt: nowIso(),
      });
      refreshed = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
      void get().refreshUnreadWorkspaces();
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }

    if (openCompletionHoldForContainer({ get, sessionId, containerId }) !== null) {
      return;
    }

    const next = children[completedCount];
    if (!next) {
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
    if (!hasInstructions(clusters[completedCount])) {
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
      role: 'implementer',
      promptText: `${next.name}\n${clusters[completedCount]?.instructions ?? ''}`,
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
      content: composeClusterKickoff(next.id, goalTitle, clusters, completedCount),
    });
  };
};
