import { capabilityObligationIdentity, validateCapabilityNeed } from '@goodboy/core';
import type { Agent, AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import {
  invokeCapabilityNeedRecord,
  invokeClusterCompletionHolds,
} from '../../../features/workflows/workflows';
import {
  inferAgentKindFromName,
  KIND_TO_ROLE,
  type AgentKind,
} from '../../../features/session/agent-kind';
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

const clusterContainerOf = ({ agent }: { readonly agent: Agent }): AgentId | null =>
  agent.executionPurpose === 'cluster' && agent.parentAgentId != null ? agent.parentAgentId : null;

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
  const kind =
    (agent.kind as AgentKind | undefined) ??
    get().agentKindOverride[agentId] ??
    inferAgentKindFromName(agent.name);
  const requesterRole = KIND_TO_ROLE[kind];
  const { inventory } = issuedAgentInventory({ get, sessionId, agentId });
  const validation = validateCapabilityNeed({
    assistantText,
    emittingProvider: agentEmittingProvider({ state: get(), sessionId, agentId }),
    requesterAgentId: agentId,
    requesterRole,
    inventoryRevision: inventory.revision,
  });
  if (validation.kind === 'none') {
    return { kind: 'none' };
  }
  if (validation.kind === 'rejected') {
    void get().emitNotification(
      'error',
      'warning',
      `need refused: ${agent.name}`,
      validation.reason,
      { sessionId },
    );
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
    holdContainerAgentId: clusterContainerOf({ agent }),
  });
  if (obligation.holdIds.length > 0) {
    const holds = await invokeClusterCompletionHolds({ sessionId });
    set((state) => ({
      clusterCompletionHolds: { ...state.clusterCompletionHolds, [sessionId]: holds },
    }));
  }
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
  void get().emitNotification(
    'error',
    'warning',
    `need recorded: ${agent.name}`,
    `${need.targetRole} for ${need.purpose}: ${need.question}`,
    { sessionId },
  );
  void get().decideCapabilityNeed({ sessionId, obligationId: obligation.id });
  return { kind: 'captured', obligationId: obligation.id };
};
