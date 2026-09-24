import { capabilityObligationIdentity, validateCapabilityNeed } from '@goodboy/core';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { invokeCapabilityNeedRecord } from '../../../features/workflows/workflows';
import { classifyAgent, KIND_TO_ROLE, type AgentKind } from '../../../features/session/agent-kind';
import { agentEmittingProvider } from '../workflowRouting/agentEmittingProvider';
import { issuedAgentInventory } from './agentEvidenceInventory';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly assistantText: string;
};

export type CapabilityNeedCapture =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'rejected'; reason: string }>
  | Readonly<{ kind: 'captured'; obligationId: string }>;

export const needBlocksCompletion = ({
  capture,
}: {
  readonly capture: CapabilityNeedCapture;
}): boolean => capture.kind === 'captured';

export const captureCapabilityNeed = async ({
  set,
  get,
  sessionId,
  agentId,
  runId,
  assistantText,
}: Params): Promise<CapabilityNeedCapture> => {
  const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  if (agent === undefined) {
    return { kind: 'none' };
  }
  const kind = classifyAgent({ agent, override: get().agentKindOverride[agentId] ?? null });
  const requesterRole = KIND_TO_ROLE[kind];
  const { inventory } = issuedAgentInventory({ get, sessionId, agentId });
  const validation = validateCapabilityNeed({
    assistantText,
    emittingProvider: agentEmittingProvider({ state: get(), sessionId, agentId }),
    requesterAgentId: agentId,
    requesterRole,
    inventoryRevision: inventory.revision,
    inventorySourceIds: new Set(inventory.entries.map((entry) => entry.sourceId)),
  });
  if (validation.kind === 'none') {
    return { kind: 'none' };
  }
  if (validation.kind === 'rejected') {
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `Need refused for ${agent.name}`,
      body: validation.reason,
      sessionId,
    });
    return { kind: 'rejected', reason: validation.reason };
  }
  const need = validation.need;
  const identity = capabilityObligationIdentity({
    requesterAgentId: agentId,
    targetRole: need.targetRole,
    purpose: need.purpose,
  });
  const obligation = await invokeCapabilityNeedRecord({
    requestId: `capability-request:${agentId}:${runId}`,
    obligationId: `capability-obligation:${identity}`,
    identity,
    sessionId,
    workflowRunId: agent.workflowRunId ?? null,
    requesterAgentId: agentId,
    sourceTurnId: runId,
    targetRole: need.targetRole,
    purpose: need.purpose,
    question: need.question,
    scope: need.scope,
    evidenceRefs: need.evidenceRefs,
    gap: need.gap,
    expectedOutput: need.expectedOutput,
    continuation: need.continuation,
    routingProposal: need.routingProposal,
    inventoryRevision: need.inventoryRevision,
  });
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
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `Need recorded for ${agent.name}`,
    body: `${need.targetRole} for ${need.purpose}: ${need.question}`,
    sessionId,
  });
  void get().decideCapabilityNeed({ sessionId, obligationId: obligation.id });
  return { kind: 'captured', obligationId: obligation.id };
};
