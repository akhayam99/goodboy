import { normalizeAgentRole, type OrchestratorNeedRequest } from '@goodboy/core';
import type { Agent, CapabilityObligation, EvidenceEntry, EvidenceInventory } from '@goodboy/types';

type RequestParams = {
  readonly obligation: CapabilityObligation;
  readonly requester: Agent;
  readonly requesterRole: string;
};

export const buildNeedRequest = ({
  obligation,
  requester,
  requesterRole,
}: RequestParams): OrchestratorNeedRequest | null => {
  const request = obligation.requests[obligation.requests.length - 1];
  if (request === undefined) {
    return null;
  }
  return {
    obligationId: obligation.id,
    requesterName: requester.name,
    requesterRole: normalizeAgentRole({ role: requesterRole }),
    targetRole: obligation.targetRole,
    purpose: obligation.purpose,
    question: request.question,
    gap: request.gap,
    scope: request.scope,
    expectedOutput: request.expectedOutput,
    continuation: request.continuation,
    evidenceRefs: request.evidenceRefs,
    inventoryRevision: request.inventoryRevision,
  };
};

type ExcerptParams = {
  readonly inventory: EvidenceInventory;
  readonly evidenceRefs: ReadonlyArray<string>;
};

export const buildEvidenceExcerpts = ({
  inventory,
  evidenceRefs,
}: ExcerptParams): ReadonlyArray<EvidenceEntry> =>
  inventory.entries.filter((entry) => evidenceRefs.includes(entry.sourceId));

type UnresolvedParams = {
  readonly obligations: ReadonlyArray<CapabilityObligation>;
  readonly agents: ReadonlyArray<Agent>;
  readonly excludeObligationId: string;
};

export const buildUnresolvedObligations = ({
  obligations,
  agents,
  excludeObligationId,
}: UnresolvedParams) =>
  obligations
    .filter(
      (obligation) =>
        obligation.id !== excludeObligationId &&
        (obligation.state === 'open' || obligation.state === 'granted'),
    )
    .map((obligation) => ({
      obligationId: obligation.id,
      identity: obligation.identity,
      targetRole: obligation.targetRole,
      purpose: obligation.purpose,
      state: obligation.state,
      ownerName:
        agents.find((agent) => agent.id === obligation.ownerAgentId)?.name ??
        (obligation.ownerAgentId === null ? null : obligation.ownerAgentId),
    }));
