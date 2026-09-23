import { extractClusterOutcome, isAgentRole, verificationRoleForGrant } from '@goodboy/core';
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
  invokeCapabilityNeedRecord,
  invokeCapabilityObligationDecide,
  invokeCapabilityObligationReopen,
  invokeCapabilityObligationSettle,
} from '../../../features/workflows/workflows';
import { composeKickoff, composeVerificationVerdict } from '../../kickoff';
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
  | Readonly<{ kind: 'inactive'; reason: string }>
  | Readonly<{ kind: 'verification-started'; verifierAgentId: AgentId }>
  | Readonly<{ kind: 'verification-rejected'; reason: string }>
  | Readonly<{ kind: 'replacement-started'; replacementAgentId: AgentId }>
  | Readonly<{ kind: 'parent-resumed' }>
  | Readonly<{ kind: 'settled'; verifiedRevision: string }>
  | Readonly<{ kind: 'unverified'; reason: string }>
  | Readonly<{ kind: 'revision-adopted'; revision: number }>
  | Readonly<{ kind: 'revision-refused'; reason: string }>;

type Binding = Readonly<{
  obligation: CapabilityObligation;
  grant: CapabilityGrant;
  isVerification: boolean;
  isReplacement: boolean;
}>;

const TRANSFER_VERIFICATION_ROLE: AgentRole = 'reviewer';

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
    grants.find((candidate) => candidate.replacementAgentId === agentId) ??
    null;
  if (grant === null) {
    return null;
  }
  const obligation = obligations.find((candidate) => candidate.id === grant.obligationId) ?? null;
  if (obligation === null) {
    return null;
  }
  return {
    obligation,
    grant,
    isVerification: grant.verificationAgentId === agentId,
    isReplacement: grant.verificationAgentId !== agentId && grant.replacementAgentId === agentId,
  };
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
}): Promise<string | null> => {
  const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
  if (worktreePath === null) {
    return null;
  }
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  return status?.head ?? null;
};

const UNREAD_REVISION =
  'the revision that was checked could not be read, so the obligation stays open and nothing was released';

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
  readonly isRequesterContinuing: boolean;
};

const settleAndRelease = async ({
  set,
  get,
  sessionId,
  binding,
  receipt,
  isRequesterContinuing,
}: SettleParams): Promise<string | null> => {
  const revision = await verifiedRevision({ get, sessionId });
  if (revision === null) {
    void get().emitNotification(
      'error',
      'warning',
      `${binding.obligation.purpose} not closed`,
      `${UNREAD_REVISION}. ${receipt}`,
      { sessionId },
    );
    return null;
  }
  const settled = await invokeCapabilityObligationSettle({
    obligationId: binding.obligation.id,
    verifiedRevision: revision,
    deliveryReceipt: receipt,
  });
  rememberObligation({ set, sessionId, obligation: settled });
  await releaseCapabilityHolds({
    set,
    get,
    sessionId,
    obligation: settled,
    isRequesterContinuing,
  });

  return revision;
};

type FinishRequesterParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligationId: string;
  readonly output: string;
};

const finishHandedOffRequester = async ({
  get,
  sessionId,
  obligationId,
  output,
}: FinishRequesterParams): Promise<void> => {
  const obligation = (get().capabilityObligations[sessionId] ?? []).find(
    (candidate) => candidate.id === obligationId,
  );
  if (obligation?.state !== 'satisfied' || obligation.holdIds.length > 0) {
    return;
  }
  const requester = (get().sessionPhaseRuns[sessionId] ?? []).find(
    (agent) => agent.id === obligation.requesterAgentId,
  );
  if (
    requester === undefined ||
    !requester.stepId ||
    !requester.workflowRunId ||
    requester.status === 'completed'
  ) {
    return;
  }
  const { shouldAutoAdvance } = await get().finalizeWorkflowStep(
    sessionId,
    requester.id,
    output,
    false,
    { force: true },
  );
  if (shouldAutoAdvance) {
    void get().maybeAutoAdvanceWorkflow(sessionId);
  }
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
    isRequesterContinuing: false,
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

const transferVerificationPrompt = ({
  reporter,
  outputSummary,
  transferredWork,
}: {
  readonly reporter: string;
  readonly outputSummary: string;
  readonly transferredWork: string | null;
}): string =>
  [
    `${reporter} took over the work its requester transferred and reports it done.`,
    '',
    `What it reports: ${outputSummary}`,
    '',
    transferredWork ?? '',
    '',
    'Verify the changed revision against the remaining criteria only. Do not widen the scope and do not fix anything yourself: report whether the work holds, and why.',
  ].join('\n');

const inactiveReasonOf = ({ binding }: { readonly binding: Binding }): string | null => {
  if (binding.obligation.state === 'satisfied' || binding.grant.state === 'settled') {
    return 'the obligation is already closed';
  }
  if (binding.obligation.state === 'refused') {
    return 'the obligation was refused';
  }
  if (binding.grant.state === 'cancelled' || binding.grant.state === 'failed') {
    return `the grant is ${binding.grant.state}`;
  }
  return null;
};

type ResumeRequesterParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly binding: Binding;
  readonly verifier: Agent;
  readonly verifierSummary: string;
  readonly revision: string;
};

const resumeRequesterAfterVerification = ({
  get,
  sessionId,
  binding,
  verifier,
  verifierSummary,
  revision,
}: ResumeRequesterParams): void => {
  const { obligation, grant } = binding;
  const repairer =
    grant.childAgentId === null
      ? null
      : ((get().sessionPhaseRuns[sessionId] ?? []).find(
          (agent) => agent.id === grant.childAgentId,
        ) ?? null);
  const repaired = repairer?.outputSummary ?? verifierSummary;
  const evidenceRefs = obligation.requests[obligation.requests.length - 1]?.evidenceRefs ?? [];
  void get().sendTurn({
    sessionId,
    agentId: obligation.requesterAgentId,
    content: [
      `The ${obligation.purpose} you asked for is done and ${verifier.name} verified it at revision ${revision}.`,
      '',
      `What was repaired: ${repaired}`,
      '',
      `Evidence: ${evidenceRefs.length === 0 ? 'none named' : evidenceRefs.join(', ')}`,
      '',
      'Continue the work you were on from this revision.',
    ].join('\n'),
  });
};

type StartVerificationParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
  readonly role: AgentRole;
  readonly name: string;
  readonly prompt: string;
};

const startVerification = async ({
  set,
  get,
  sessionId,
  obligation,
  role,
  name,
  prompt,
}: StartVerificationParams): Promise<CapabilityCompletionOutcome> => {
  const verifierAgentId = await get().spawnAgent(sessionId, {
    name,
    kindOverride: ROLE_TO_KIND[role],
    parentAgentId: obligation.requesterAgentId,
    executionPurpose: 'capability',
    ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
  });
  const updated = await invokeCapabilityGrantUpdate({
    obligationId: obligation.id,
    state: 'delivered',
    childAgentId: null,
    replacementAgentId: null,
    verificationAgentId: verifierAgentId,
  });
  rememberGrant({ set, sessionId, grant: updated });
  void get().sendTurn({
    sessionId,
    agentId: verifierAgentId,
    content: composeKickoff(prompt, composeVerificationVerdict({ agentId: verifierAgentId })),
  });
  return { kind: 'verification-started', verifierAgentId };
};

type Verdict = Readonly<{ kind: 'clear' }> | Readonly<{ kind: 'rejected'; reason: string }>;

const verdictOf = ({
  assistantText,
  verifierId,
}: {
  readonly assistantText: string;
  readonly verifierId: AgentId;
}): Verdict => {
  const extraction = extractClusterOutcome({ assistantText });
  if (extraction.kind === 'missing') {
    return { kind: 'rejected', reason: 'the verifier gave no verdict' };
  }
  if (extraction.kind === 'malformed') {
    return { kind: 'rejected', reason: 'the verifier verdict is malformed' };
  }
  if (extraction.outcome.id !== verifierId) {
    return { kind: 'rejected', reason: 'the verdict names another agent' };
  }
  if (extraction.outcome.status === 'clear') {
    return { kind: 'clear' };
  }
  const reasons = extraction.outcome.findings.map((finding) => finding.reason);
  return {
    kind: 'rejected',
    reason:
      reasons.length === 0
        ? 'the verifier left the change unresolved'
        : `the verifier left the change unresolved: ${reasons.join('; ')}`,
  };
};

type RejectVerificationParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly binding: Binding;
  readonly verifier: Agent;
  readonly reason: string;
};

const rejectVerification = async ({
  set,
  get,
  sessionId,
  binding,
  verifier,
  reason,
}: RejectVerificationParams): Promise<CapabilityCompletionOutcome> => {
  const { obligation } = binding;
  const failed = await invokeCapabilityGrantUpdate({
    obligationId: obligation.id,
    state: 'failed',
    childAgentId: null,
    replacementAgentId: null,
    verificationAgentId: null,
  });
  rememberGrant({ set, sessionId, grant: failed });
  const reopened = await invokeCapabilityObligationReopen({
    obligationId: obligation.id,
    reason: `${obligation.purpose} not accepted: ${reason}`,
  });
  rememberObligation({ set, sessionId, obligation: reopened });
  const previous = obligation.requests[obligation.requests.length - 1] ?? null;
  const recorded = await invokeCapabilityNeedRecord({
    requestId: `capability-request:${obligation.requesterAgentId}:verification:${verifier.id}`,
    obligationId: obligation.id,
    identity: obligation.identity,
    sessionId,
    workflowRunId: obligation.workflowRunId,
    requesterAgentId: obligation.requesterAgentId,
    sourceTurnId: `verification:${verifier.id}`,
    targetRole: obligation.targetRole,
    purpose: obligation.purpose,
    question: previous?.question ?? `${obligation.purpose} for ${obligation.identity}`,
    scope: previous?.scope ?? [],
    evidenceRefs: previous?.evidenceRefs ?? [],
    gap: `${verifier.name} did not accept the last attempt. ${reason}`,
    expectedOutput:
      previous?.expectedOutput ?? 'a change a focused verification accepts with a clear verdict',
    continuation: previous?.continuation ?? 'handoff',
    routingProposal: null,
    inventoryRevision: previous?.inventoryRevision ?? '',
    holdContainerAgentId: null,
  });
  rememberObligation({ set, sessionId, obligation: recorded });
  void get().emitNotification(
    'error',
    'warning',
    `${obligation.purpose} not accepted: ${verifier.name}`,
    `${reason}. the obligation stays open, nothing is released, and the need goes back to the orchestrator.`,
    { sessionId },
  );
  void get().decideCapabilityNeed({ sessionId, obligationId: obligation.id });
  return { kind: 'verification-rejected', reason };
};

type StartReplacementParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
  readonly role: AgentRole;
  readonly findings: string;
  readonly transferredWork: string | null;
};

const startReplacement = async ({
  set,
  get,
  sessionId,
  obligation,
  role,
  findings,
  transferredWork,
}: StartReplacementParams): Promise<CapabilityCompletionOutcome> => {
  const replacementAgentId = await get().spawnAgent(sessionId, {
    name: `resume the transferred work: ${obligation.purpose}`,
    kindOverride: ROLE_TO_KIND[role],
    parentAgentId: obligation.requesterAgentId,
    executionPurpose: 'capability',
    obligationId: obligation.id,
    ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
    initialPrompt: [
      'You are taking over work that was transferred, not resumed. None of the earlier context survives.',
      '',
      `What the specialist found: ${findings}`,
      '',
      transferredWork === null ? '' : transferredWork,
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
  return { kind: 'replacement-started', replacementAgentId };
};

type FailParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly message: string;
};

export const failCapabilityChild = async ({
  set,
  get,
  sessionId,
  agentId,
  message,
}: FailParams): Promise<boolean> => {
  const binding = capabilityBindingFor({ get, sessionId, agentId });
  if (binding === null || binding.obligation.state !== 'granted') {
    return false;
  }
  const { obligation } = binding;
  const failed = await invokeCapabilityGrantUpdate({
    obligationId: obligation.id,
    state: 'failed',
    childAgentId: null,
    replacementAgentId: null,
    verificationAgentId: null,
  });
  rememberGrant({ set, sessionId, grant: failed });
  const reason = `the agent granted for this ${obligation.purpose} failed before it reported back: ${message}`;
  const refused = await invokeCapabilityObligationDecide({
    obligationId: obligation.id,
    decision: 'refused',
    reason,
  });
  rememberObligation({ set, sessionId, obligation: refused });
  void get().emitNotification(
    'error',
    'warning',
    `${obligation.purpose} failed`,
    `${reason}. the obligation is closed as refused and nothing was released.`,
    { sessionId },
  );
  return true;
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
  const inactiveReason = inactiveReasonOf({ binding });
  if (inactiveReason !== null) {
    return { kind: 'inactive', reason: inactiveReason };
  }
  const replacementRole = replacementRoleOf({ transferredWork: grant.transferredWork });
  const pendingReplacementRole =
    grant.parentOutcome === 'transferred' && grant.replacementAgentId === null
      ? replacementRole
      : null;

  if (binding.isReplacement) {
    return startVerification({
      set,
      get,
      sessionId,
      obligation,
      role: TRANSFER_VERIFICATION_ROLE,
      name: `verify the transferred work: ${child.name}`,
      prompt: transferVerificationPrompt({
        reporter: 'A replacement',
        outputSummary,
        transferredWork: grant.transferredWork,
      }),
    });
  }

  const verdict = binding.isVerification
    ? verdictOf({ assistantText, verifierId: child.id })
    : null;
  if (verdict !== null && verdict.kind === 'rejected') {
    return rejectVerification({
      set,
      get,
      sessionId,
      binding,
      verifier: child,
      reason: verdict.reason,
    });
  }

  if (binding.isVerification && pendingReplacementRole !== null) {
    return startReplacement({
      set,
      get,
      sessionId,
      obligation,
      role: pendingReplacementRole,
      findings: outputSummary,
      transferredWork: grant.transferredWork,
    });
  }

  if (binding.isVerification && grant.parentOutcome === 'resumed') {
    const revision = await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} verified by ${child.name}: ${outputSummary}`,
      isRequesterContinuing: true,
    });
    if (revision === null) {
      return { kind: 'unverified', reason: UNREAD_REVISION };
    }
    resumeRequesterAfterVerification({
      get,
      sessionId,
      binding,
      verifier: child,
      verifierSummary: outputSummary,
      revision,
    });
    return { kind: 'parent-resumed' };
  }

  if (binding.isVerification) {
    const revision = await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} verified by ${child.name}: ${outputSummary}`,
      isRequesterContinuing: false,
    });
    if (revision === null) {
      return { kind: 'unverified', reason: UNREAD_REVISION };
    }
    await finishHandedOffRequester({
      get,
      sessionId,
      obligationId: obligation.id,
      output: `The ${grant.grantedRole} this step handed off to finished and ${child.name} verified it: ${outputSummary}`,
    });
    return { kind: 'settled', verifiedRevision: revision };
  }

  if (obligation.purpose === 'replan') {
    return adoptProposal({ set, get, sessionId, child, assistantText, binding, outputSummary });
  }

  const verificationRole = verificationRoleForGrant({ purpose: obligation.purpose });
  if (verificationRole !== null) {
    return startVerification({
      set,
      get,
      sessionId,
      obligation,
      role: verificationRole,
      name: `verify ${obligation.purpose}: ${child.name}`,
      prompt: [
        `A ${grant.grantedRole} was granted a bounded ${obligation.purpose} and reports it done.`,
        '',
        `What it reports: ${outputSummary}`,
        '',
        'Verify the changed revision only. Do not widen the scope, do not repeat the whole review, and do not fix anything yourself: report whether the change holds, and why.',
      ].join('\n'),
    });
  }

  if (pendingReplacementRole !== null) {
    return startReplacement({
      set,
      get,
      sessionId,
      obligation,
      role: pendingReplacementRole,
      findings: outputSummary,
      transferredWork: grant.transferredWork,
    });
  }

  if (grant.parentOutcome === 'transferred') {
    return startVerification({
      set,
      get,
      sessionId,
      obligation,
      role: TRANSFER_VERIFICATION_ROLE,
      name: `verify the transferred work: ${child.name}`,
      prompt: transferVerificationPrompt({
        reporter: `A ${grant.grantedRole}`,
        outputSummary,
        transferredWork: grant.transferredWork,
      }),
    });
  }

  if (grant.parentOutcome === 'resumed') {
    const revision = await settleAndRelease({
      set,
      get,
      sessionId,
      binding,
      receipt: `${obligation.purpose} answered by ${child.name}`,
      isRequesterContinuing: true,
    });
    if (revision === null) {
      return { kind: 'unverified', reason: UNREAD_REVISION };
    }
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
    isRequesterContinuing: false,
  });
  if (revision === null) {
    return { kind: 'unverified', reason: UNREAD_REVISION };
  }
  await finishHandedOffRequester({
    get,
    sessionId,
    obligationId: obligation.id,
    output: assistantText,
  });
  return { kind: 'settled', verifiedRevision: revision };
};
