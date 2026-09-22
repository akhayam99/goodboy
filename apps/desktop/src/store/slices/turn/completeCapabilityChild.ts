import { isAgentRole, verificationRoleForGrant } from '@goodboy/core';
import type {
  Agent,
  AgentId,
  AgentRole,
  CapabilityGrant,
  CapabilityObligation,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import {
  invokeAgentList,
  invokeAgentUpdateStatus,
  invokeCapabilityGrantUpdate,
  invokeCapabilityObligationDecide,
  invokeCapabilityObligationSettle,
} from '../../../features/workflows/workflows';
import { ROLE_TO_KIND } from '../../../features/session/agent-kind';
import { worktreeStatus } from '../../../features/worktree/worktree';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { adoptClusterGraphRevision } from '../workflows/adoptClusterGraphRevision';
import { resumeClusterChildren } from '../workflows/clusterImplementation';
import { releaseCapabilityHolds } from '../workflows/releaseCapabilityHolds';
import { summarizeWorkflowAgentOutput } from '../workflows/summarizeWorkflowAgentOutput';
import type { GetFn, SetFn } from './types';

export type CapabilityCompletionOutcome =
  | Readonly<{ kind: 'unbound' }>
  | Readonly<{ kind: 'verification-started'; verifierAgentId: AgentId }>
  | Readonly<{ kind: 'replacement-started'; replacementAgentId: AgentId }>
  | Readonly<{ kind: 'parent-resumed' }>
  | Readonly<{ kind: 'settled'; verifiedRevision: string }>
  | Readonly<{ kind: 'revision-adopted'; revision: number }>
  | Readonly<{ kind: 'revision-refused'; reason: string }>;

type Binding = Readonly<{
  obligation: CapabilityObligation;
  grant: CapabilityGrant;
  isVerification: boolean;
}>;

type BindingParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const capabilityBindingFor = ({
  get,
  sessionId,
  agentId,
}: BindingParams): Binding | null => {
  const grants = get().capabilityGrants?.[sessionId] ?? [];
  const obligations = get().capabilityObligations?.[sessionId] ?? [];
  const grant =
    grants.find((candidate) => candidate.verificationAgentId === agentId) ??
    grants.find((candidate) => candidate.childAgentId === agentId) ??
    null;
  if (grant === null) {
    return null;
  }
  const obligation = obligations.find((candidate) => candidate.id === grant.obligationId) ?? null;
  if (obligation === null) {
    return null;
  }
  return { obligation, grant, isVerification: grant.verificationAgentId === agentId };
};

const replacementRoleOf = ({
  transferredWork,
}: {
  readonly transferredWork: string | null;
}): AgentRole | null => {
  if (transferredWork === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(transferredWork);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const role = (parsed as Record<string, unknown>)['replacementRole'];
  if (typeof role !== 'string') {
    return null;
  }
  return isAgentRole(role) ? role : null;
};

const verifiedRevision = async ({
  get,
  sessionId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
}): Promise<string> => {
  const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
  if (worktreePath === null) {
    return 'unknown-revision';
  }
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  return status?.head ?? 'unknown-revision';
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

const rememberObligation = ({
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

type SettleParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly binding: Binding;
  readonly receipt: string;
};

const settleAndRelease = async ({
  set,
  get,
  sessionId,
  binding,
  receipt,
}: SettleParams): Promise<string> => {
  const revision = await verifiedRevision({ get, sessionId });
  const settled = await invokeCapabilityObligationSettle({
    obligationId: binding.obligation.id,
    verifiedRevision: revision,
    deliveryReceipt: receipt,
  });
  rememberObligation({ set, sessionId, obligation: settled });
  await releaseCapabilityHolds({ set, get, sessionId, obligation: settled });

  return revision;
};

type AdoptProposalParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly child: Agent;
  readonly assistantText: string;
  readonly binding: Binding;
  readonly outputSummary: string;
};

type RefuseRevisionParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly child: Agent;
  readonly obligationId: string;
  readonly reason: string;
};

const refuseRevision = async ({
  set,
  get,
  sessionId,
  child,
  obligationId,
  reason,
}: RefuseRevisionParams): Promise<CapabilityCompletionOutcome> => {
  const failed = await invokeCapabilityGrantUpdate({
    obligationId,
    state: 'failed',
    childAgentId: null,
    replacementAgentId: null,
    verificationAgentId: null,
  });
  rememberGrant({ set, sessionId, grant: failed });
  const refused = await invokeCapabilityObligationDecide({
    obligationId,
    decision: 'refused',
    reason,
  });
  rememberObligation({ set, sessionId, obligation: refused });
  void get().emitNotification(
    'error',
    'warning',
    `plan revision not adopted: ${child.name}`,
    `${reason}. the plan in flight stays frozen, the finding stays open and nothing was superseded.`,
    { sessionId },
  );
  return { kind: 'revision-refused', reason };
};

const adoptProposal = async ({
  set,
  get,
  sessionId,
  child,
  assistantText,
  binding,
  outputSummary,
}: AdoptProposalParams): Promise<CapabilityCompletionOutcome> => {
  const { obligation } = binding;
  const requester =
    (get().sessionPhaseRuns[sessionId] ?? []).find(
      (agent) => agent.id === obligation.requesterAgentId,
    ) ?? null;
  const containerAgentId = requester?.parentAgentId ?? null;
  if (containerAgentId === null) {
    return refuseRevision({
      set,
      get,
      sessionId,
      child,
      obligationId: obligation.id,
      reason: 'the requester belongs to no cluster execution, so there is no graph to revise',
    });
  }
  const outcome = await adoptClusterGraphRevision({
    set,
    get,
    sessionId,
    containerAgentId,
    obligationId: obligation.id,
    proposalText: assistantText,
    reason: `${child.name} revised the plan: ${outputSummary}`,
  });
  if (outcome.kind !== 'adopted') {
    return refuseRevision({
      set,
      get,
      sessionId,
      child,
      obligationId: obligation.id,
      reason: outcome.reason,
    });
  }
  await settleAndRelease({
    set,
    get,
    sessionId,
    binding,
    receipt: `revision ${outcome.revision} adopted from ${child.name}`,
  });
  void get().emitNotification(
    'error',
    'info',
    `plan revision adopted: ${child.name}`,
    `the execution now runs revision ${outcome.revision}. superseded: ${outcome.superseded.length}, quarantined results: ${outcome.quarantined.length}, appended: ${outcome.appended.length}.`,
    { sessionId },
  );
  const container =
    (get().sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === containerAgentId) ??
    null;
  if (container !== null) {
    await resumeClusterChildren({ set, get, sessionId, container });
  }
  return { kind: 'revision-adopted', revision: outcome.revision };
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly child: Agent;
  readonly assistantText: string;
  readonly now: () => IsoDateTime;
};

export const completeCapabilityChild = async ({
  set,
  get,
  sessionId,
  child,
  assistantText,
  now,
}: Params): Promise<CapabilityCompletionOutcome> => {
  const outputSummary = await summarizeWorkflowAgentOutput({
    set,
    get,
    sessionId,
    agent: child,
    output: assistantText,
  });
  await invokeAgentUpdateStatus(child.id, {
    status: 'completed',
    outputSummary,
    completedAt: now(),
  });
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
  void get().refreshUnreadWorkspaces();

  const binding = capabilityBindingFor({ get, sessionId, agentId: child.id });
  if (binding === null) {
    return { kind: 'unbound' };
  }
  const { obligation, grant } = binding;

  if (binding.isVerification) {
    const revision = await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} verified by ${child.name}: ${outputSummary}`,
    });
    return { kind: 'settled', verifiedRevision: revision };
  }

  if (obligation.purpose === 'replan') {
    return adoptProposal({ set, get, sessionId, child, assistantText, binding, outputSummary });
  }

  const verificationRole = verificationRoleForGrant({ purpose: obligation.purpose });
  if (verificationRole !== null) {
    const verifierAgentId = await get().spawnAgent(sessionId, {
      name: `verify ${obligation.purpose}: ${child.name}`,
      kindOverride: ROLE_TO_KIND[verificationRole],
      parentAgentId: obligation.requesterAgentId,
      executionPurpose: 'capability',
      ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
      initialPrompt: [
        `A ${grant.grantedRole} was granted a bounded ${obligation.purpose} and reports it done.`,
        '',
        `What it reports: ${outputSummary}`,
        '',
        'Verify the changed revision only. Do not widen the scope, do not repeat the whole review, and do not fix anything yourself: report whether the change holds, and why.',
      ].join('\n'),
    });
    const updated = await invokeCapabilityGrantUpdate({
      obligationId: obligation.id,
      state: 'delivered',
      childAgentId: null,
      replacementAgentId: null,
      verificationAgentId: verifierAgentId,
    });
    rememberGrant({ set, sessionId, grant: updated });
    return { kind: 'verification-started', verifierAgentId };
  }

  const transfer = grant.transferredWork;
  const replacementRole = replacementRoleOf({ transferredWork: transfer });
  if (grant.parentOutcome === 'transferred' && replacementRole !== null) {
    const replacementAgentId = await get().spawnAgent(sessionId, {
      name: `resume the transferred work: ${obligation.purpose}`,
      kindOverride: ROLE_TO_KIND[replacementRole],
      parentAgentId: obligation.requesterAgentId,
      executionPurpose: 'capability',
      ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
      initialPrompt: [
        'You are taking over work that was transferred, not resumed. None of the earlier context survives.',
        '',
        `What the specialist found: ${outputSummary}`,
        '',
        transfer === null ? '' : transfer,
      ].join('\n'),
    });
    const updated = await invokeCapabilityGrantUpdate({
      obligationId: obligation.id,
      state: 'delivered',
      childAgentId: null,
      replacementAgentId,
      verificationAgentId: null,
    });
    rememberGrant({ set, sessionId, grant: updated });
    await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} answered by ${child.name}, the remaining work moved to a replacement`,
    });
    return { kind: 'replacement-started', replacementAgentId };
  }

  if (grant.parentOutcome === 'resumed') {
    await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} answered by ${child.name}`,
    });
    void get().sendTurn({
      sessionId,
      agentId: obligation.requesterAgentId,
      content: [
        `The ${grant.grantedRole} you asked for reports back.`,
        '',
        outputSummary,
        '',
        'Continue the work you were on with this answer.',
      ].join('\n'),
    });
    return { kind: 'parent-resumed' };
  }

  const revision = await settleAndRelease({
    set,
    get,
    sessionId,
    binding,
    receipt: `${obligation.purpose} answered by ${child.name}`,
  });
  return { kind: 'settled', verifiedRevision: revision };
};
