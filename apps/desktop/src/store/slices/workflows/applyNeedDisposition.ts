import {
  isDelegationGranted,
  resolveContinuationEligibility,
  resolveGrantExecution,
  type GrantExecutionPlan,
  type OrchestratorDecision,
} from '@goodboy/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  CapabilityGrant,
  CapabilityObligation,
  CapabilityParentOutcome,
  ProviderId,
  SessionId,
} from '@goodboy/types';
import { GENERATION_STRUCTURAL_REPLAN_CAP, PROVIDER_IDS } from '@goodboy/types';
import {
  invokeAgentList,
  invokeAgentUpdateStatus,
  invokeCapabilityGrantClaim,
  invokeCapabilityObligationDecide,
  invokeCapabilityObligationSettle,
  invokeCapabilityGrantUpdate,
} from '../../../features/workflows/workflows';
import { claimCapabilityObligationOwner } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  inferAgentKindFromName,
  KIND_TO_ROLE,
  ROLE_TO_KIND,
  type AgentKind,
} from '../../../features/session/agent-kind';
import {
  composeCapabilityKickoff,
  transferredParentSummary,
  type PlanRevisionBrief,
  type PlanRevisionNodeBrief,
  type TransferPacket,
} from './composeCapabilityKickoff';
import { freezeClusterExecution } from './clusterImplementation';
import type { GetFn, SetFn } from './types';

export type NeedDispositionOutcome =
  | Readonly<{ kind: 'granted'; childAgentId: AgentId; plan: GrantExecutionPlan }>
  | Readonly<{ kind: 'already-delivered' }>
  | Readonly<{ kind: 'attached'; ownerAgentId: AgentId }>
  | Readonly<{ kind: 'reused'; evidenceRefs: ReadonlyArray<string> }>
  | Readonly<{ kind: 'refined'; reason: string }>
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{ kind: 'unavailable'; reason: string }>;

type NeedDecision = Extract<OrchestratorDecision, { readonly action: 'need' }>;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
  readonly decision: NeedDecision;
};

const PARENT_OUTCOME: Readonly<Record<GrantExecutionPlan['kind'], CapabilityParentOutcome>> = {
  resume: 'resumed',
  transfer: 'transferred',
  handoff: 'handed-off',
};

const knownProvider = ({ id }: { readonly id: string | undefined }): ProviderId | null => {
  if (id === undefined) {
    return null;
  }
  return PROVIDER_IDS.find((candidate) => candidate === id) ?? null;
};

const roleOf = ({ agent, get }: { readonly agent: Agent; readonly get: GetFn }): string => {
  const kind =
    (agent.kind as AgentKind | undefined) ??
    get().agentKindOverride[agent.id] ??
    inferAgentKindFromName(agent.name);
  return KIND_TO_ROLE[kind];
};

const rememberGrant = ({
  set,
  sessionId,
  grant,
}: {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly grant: CapabilityGrant;
}): void => {
  set((state) => ({
    capabilityGrants: {
      ...state.capabilityGrants,
      [sessionId]: [
        ...(state.capabilityGrants[sessionId] ?? []).filter(
          (candidate) => candidate.obligationId !== grant.obligationId,
        ),
        grant,
      ],
    },
  }));
};

const refreshObligation = ({
  set,
  sessionId,
  obligation,
}: {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
}): void => {
  set((state) => ({
    capabilityObligations: {
      ...state.capabilityObligations,
      [sessionId]: [
        ...(state.capabilityObligations[sessionId] ?? []).filter(
          (candidate) => candidate.id !== obligation.id,
        ),
        obligation,
      ],
    },
  }));
};

const transferPacketFor = ({
  requester,
  replacementRole,
  evidenceRefs,
  get,
  sessionId,
}: {
  readonly requester: Agent;
  readonly replacementRole: string | null;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly get: GetFn;
  readonly sessionId: SessionId;
}): TransferPacket => {
  const node = (get().clusterExecutionGraphs?.[sessionId] ?? []).flatMap((graph) =>
    graph.nodes.flatMap((binding) =>
      binding.agentId === requester.id
        ? graph.graph.nodes.filter((entry) => entry.id === binding.nodeId)
        : [],
    ),
  )[0];
  return {
    replacementRole,
    completedWork: requester.outputSummary ?? 'nothing was summarized before the attempt ended',
    remainingCriteria: node?.expectedOutput ?? 'the acceptance criteria of the assignment it held',
    evidenceRefs,
    executionTarget: requester.providerSessionId ?? null,
  };
};

const planRevisionBrief = ({
  get,
  sessionId,
  containerId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId | null;
}): PlanRevisionBrief | null => {
  if (containerId === null) {
    return null;
  }
  const graph = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
    (candidate) => candidate.containerAgentId === containerId,
  );
  if (graph === undefined) {
    return null;
  }
  const agents = get().sessionPhaseRuns[sessionId] ?? [];
  const nodes = graph.graph.nodes.map((node): PlanRevisionNodeBrief => {
    const bindingAgentId =
      graph.nodes.find((binding) => binding.nodeId === node.id)?.agentId ?? null;
    const agent = agents.find((candidate) => candidate.id === bindingAgentId) ?? null;
    const isSuperseded =
      graph.nodes.find((binding) => binding.nodeId === node.id)?.state === 'superseded';
    return {
      id: node.id,
      title: node.title,
      role: node.role,
      state: isSuperseded
        ? 'superseded'
        : agent?.status === 'completed'
          ? 'completed'
          : agent?.status === 'running'
            ? 'running'
            : 'unstarted',
      expectedOutput: node.expectedOutput,
    };
  });
  return { goalTitle: graph.goalTitle, revision: graph.revision, nodes };
};

export const applyNeedDisposition = async ({
  set,
  get,
  sessionId,
  obligation,
  decision,
}: Params): Promise<NeedDispositionOutcome> => {
  const requester = (get().sessionPhaseRuns[sessionId] ?? []).find(
    (agent) => agent.id === obligation.requesterAgentId,
  );
  if (requester === undefined) {
    return { kind: 'unavailable', reason: 'the requesting agent is no longer loaded' };
  }
  const request = obligation.requests[obligation.requests.length - 1];
  if (request === undefined) {
    return { kind: 'unavailable', reason: 'the obligation carries no recorded request' };
  }
  const reason = decision.reason.trim();
  const disposition = decision.disposition;

  if (disposition.kind === 'refuse' || disposition.kind === 'refine') {
    const recorded = await invokeCapabilityObligationDecide({
      obligationId: obligation.id,
      decision: disposition.kind === 'refuse' ? 'refused' : 'refinement',
      reason,
    });
    refreshObligation({ set, sessionId, obligation: recorded });
    void get().emitNotification(
      'error',
      'warning',
      disposition.kind === 'refuse'
        ? `need refused: ${requester.name}`
        : `need needs narrowing: ${requester.name}`,
      reason,
      { sessionId },
    );
    void get().sendTurn({
      sessionId,
      agentId: requester.id,
      content: [
        disposition.kind === 'refuse'
          ? `Your request for a ${obligation.targetRole} (${obligation.purpose}) was refused.`
          : `Your request for a ${obligation.targetRole} (${obligation.purpose}) is too broad to grant as asked.`,
        '',
        `Reason: ${reason}`,
        '',
        disposition.kind === 'refuse'
          ? 'Continue your assignment without it and report what you could not do.'
          : 'Narrow the request and raise it again, or continue your assignment without it.',
      ].join('\n'),
    });
    return disposition.kind === 'refuse'
      ? { kind: 'refused', reason }
      : { kind: 'refined', reason };
  }

  if (disposition.kind === 'attach') {
    const owner = obligation.ownerAgentId;
    if (owner === null) {
      return {
        kind: 'unavailable',
        reason: 'nothing is running under this obligation, so there is no owner to attach to',
      };
    }
    const recorded = await invokeCapabilityObligationDecide({
      obligationId: obligation.id,
      decision: 'attached',
      reason,
    });
    refreshObligation({ set, sessionId, obligation: recorded });
    return { kind: 'attached', ownerAgentId: owner };
  }

  if (disposition.kind === 'reuse') {
    const settled = await invokeCapabilityObligationSettle({
      obligationId: obligation.id,
      verifiedRevision: request.inventoryRevision,
      deliveryReceipt: `answered from existing evidence: ${disposition.evidenceRefs.join(', ')}`,
    });
    refreshObligation({ set, sessionId, obligation: settled });
    void get().emitNotification(
      'error',
      'info',
      `need answered from evidence: ${requester.name}`,
      `${reason} sources: ${disposition.evidenceRefs.join(', ')}`,
      { sessionId },
    );
    return { kind: 'reused', evidenceRefs: disposition.evidenceRefs };
  }

  const grantedRole = disposition.step.role;
  const requesterRole = roleOf({ agent: requester, get });
  if (
    grantedRole !== obligation.targetRole ||
    !isDelegationGranted({
      requester: requesterRole,
      target: grantedRole,
      purpose: obligation.purpose,
    })
  ) {
    const refused = await invokeCapabilityObligationDecide({
      obligationId: obligation.id,
      decision: 'refused',
      reason: `the grant named ${grantedRole}, which a ${requesterRole} may not receive for ${obligation.purpose}`,
    });
    refreshObligation({ set, sessionId, obligation: refused });
    return {
      kind: 'refused',
      reason: `the grant named ${grantedRole}, which a ${requesterRole} may not receive for ${obligation.purpose}`,
    };
  }

  if (obligation.purpose === 'replan') {
    const spent = (get().capabilityGrants[sessionId] ?? []).filter(
      (grant) => grant.purpose === 'replan' && grant.obligationId !== obligation.id,
    ).length;
    if (spent >= GENERATION_STRUCTURAL_REPLAN_CAP) {
      const exhausted = `this run already took ${spent} of ${GENERATION_STRUCTURAL_REPLAN_CAP} automatic structural replans, so the escalation is refused and the obligation stays open`;
      const refused = await invokeCapabilityObligationDecide({
        obligationId: obligation.id,
        decision: 'refused',
        reason: exhausted,
      });
      refreshObligation({ set, sessionId, obligation: refused });
      void get().emitNotification(
        'error',
        'warning',
        `replan refused: ${requester.name}`,
        `${exhausted}. the finding stays visible and the plan in flight stays frozen.`,
        { sessionId },
      );
      return { kind: 'refused', reason: exhausted };
    }
    if (requester.parentAgentId != null) {
      const frozen = await freezeClusterExecution({
        set,
        get,
        sessionId,
        containerId: requester.parentAgentId,
        reason: `a replan was granted for ${obligation.identity}`,
        obligationId: obligation.id,
      });
      if (frozen === null) {
        const unfrozen =
          'the execution graph could not be frozen, so a replan would run while queued nodes stay runnable';
        const refused = await invokeCapabilityObligationDecide({
          obligationId: obligation.id,
          decision: 'refused',
          reason: unfrozen,
        });
        refreshObligation({ set, sessionId, obligation: refused });
        void get().emitNotification(
          'error',
          'warning',
          `replan refused: ${requester.name}`,
          `${unfrozen}. no planner was started.`,
          { sessionId },
        );
        return { kind: 'refused', reason: unfrozen };
      }
    }
  }

  const stepProvider = knownProvider({ id: disposition.step.provider });
  const provider =
    requester.providerOverride ??
    get().agentProviderOverride[requester.id] ??
    requester.providerSessionProviderId ??
    null;
  const eligibility = resolveContinuationEligibility({
    providerId: provider ?? 'anthropic',
    binary: null,
    providerSessionId: requester.providerSessionId ?? null,
    providerSessionProviderId: requester.providerSessionProviderId ?? null,
  });
  const plan = resolveGrantExecution({
    requesterRole,
    requestedContinuation: request.continuation,
    grantedRole,
    eligibility,
  });
  const transfer =
    plan.kind === 'transfer'
      ? transferPacketFor({
          requester,
          replacementRole: plan.replacementRole,
          evidenceRefs: request.evidenceRefs,
          get,
          sessionId,
        })
      : null;

  const claim = await invokeCapabilityGrantClaim({
    id: `capability-grant:${obligation.id}`,
    obligationId: obligation.id,
    sessionId,
    workflowRunId: obligation.workflowRunId,
    grantedRole,
    purpose: obligation.purpose,
    continuation: request.continuation,
    parentOutcome: PARENT_OUTCOME[plan.kind],
    transferredWork: transfer === null ? null : JSON.stringify(transfer),
  });
  if (!claim.isFirstDelivery) {
    rememberGrant({ set, sessionId, grant: claim.grant });
    return { kind: 'already-delivered' };
  }

  const childAgentId = await get().spawnAgent(sessionId, {
    name: disposition.step.name,
    kindOverride: ROLE_TO_KIND[grantedRole],
    parentAgentId: requester.id,
    executionPurpose: 'capability',
    generationPurpose: obligation.purpose,
    ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
    ...(stepProvider !== null && { provider: stepProvider }),
    ...(disposition.step.model !== undefined && { model: disposition.step.model }),
    ...(disposition.step.effort !== undefined && { effort: disposition.step.effort }),
    initialPrompt: composeCapabilityKickoff({
      request,
      requesterName: requester.name,
      promptPrefix: disposition.step.promptPrefix,
      transfer,
      planRevision:
        obligation.purpose === 'replan'
          ? planRevisionBrief({ get, sessionId, containerId: requester.parentAgentId ?? null })
          : null,
    }),
  });

  const delivered = await invokeCapabilityGrantUpdate({
    obligationId: obligation.id,
    state: 'delivered',
    childAgentId,
    replacementAgentId: null,
    verificationAgentId: null,
  });
  rememberGrant({ set, sessionId, grant: delivered });
  await claimCapabilityObligationOwner({
    db: tauriDatabase,
    identity: obligation.identity,
    ownerAgentId: childAgentId,
    childAgentId,
  });
  const granted = await invokeCapabilityObligationDecide({
    obligationId: obligation.id,
    decision: 'granted',
    reason,
  });
  refreshObligation({ set, sessionId, obligation: granted });

  if (plan.kind === 'transfer') {
    await invokeAgentUpdateStatus(requester.id, {
      status: 'failed',
      outputSummary: transferredParentSummary({
        grantedRole,
        purpose: obligation.purpose,
      }),
      completedAt: new Date().toISOString() as IsoDateTime,
    });
    const refreshed = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
    }));
    void get().emitNotification(
      'error',
      'warning',
      `work transferred: ${requester.name}`,
      `${plan.reason}. the attempt ended partial and its remaining work moved on without its context.`,
      { sessionId },
    );
  }

  return { kind: 'granted', childAgentId, plan };
};
