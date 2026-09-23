import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityObligation,
  EvidenceInventory,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  buildEvidenceExcerpts,
  buildNeedRequest,
  buildUnresolvedObligations,
} from './buildNeedPacket';

const SESSION_ID = 'session-1' as SessionId;
const REQUESTER_ID = 'agent-1' as AgentId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;

const requester: Agent = {
  id: REQUESTER_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'review the change',
  kind: 'reviewer',
  status: 'completed',
  workflowRunId: RUN_ID,
};

const obligation: CapabilityObligation = {
  id: 'capability-obligation:agent-1:implementer:repair',
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  identity: 'agent-1:implementer:repair',
  requesterAgentId: REQUESTER_ID,
  requesterParentAgentId: null,
  targetRole: 'implementer',
  purpose: 'repair',
  state: 'open',
  ownerAgentId: null,
  decision: null,
  decisionReason: null,
  satisfiedRevision: null,
  childAgentId: null,
  deliveredAt: null,
  deliveryReceipt: null,
  requests: [
    {
      id: 'capability-request:agent-1:run-1',
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      obligationId: 'capability-obligation:agent-1:implementer:repair',
      requesterAgentId: REQUESTER_ID,
      sourceTurnId: 'run-1',
      targetRole: 'implementer',
      purpose: 'repair',
      question: 'restore the dropped null guard',
      scope: ['apps/desktop/src/store/slices/turn/sendTurn.ts'],
      evidenceRefs: ['review:finding-1'],
      gap: 'the failing path was never executed',
      expectedOutput: 'the guard back with a regression test',
      continuation: 'handoff',
      routingProposal: null,
      inventoryRevision: 'rabc',
      createdAt: '2026-07-30T00:00:00.000Z',
    },
  ],
  holdIds: ['hold-1'],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

const inventory: EvidenceInventory = {
  agentId: REQUESTER_ID,
  revision: 'rabc',
  entries: [
    {
      sourceId: 'review:finding-1',
      kind: 'finding',
      label: 'the guard is gone',
      provenance: 'review of the cluster',
      revision: 'rabc',
      availability: 'delivered',
      detail: 'the null branch is unreachable',
    },
    {
      sourceId: 'artifact:plan-2',
      kind: 'artifact',
      label: 'the plan',
      provenance: 'plan artifact',
      revision: 'rabc',
      availability: 'retrievable',
      detail: null,
    },
  ],
  omittedCount: 0,
};

describe('buildNeedRequest', () => {
  it('carries the validated request verbatim', () => {
    expect(buildNeedRequest({ obligation, requester, requesterRole: 'reviewer' })).toEqual({
      obligationId: obligation.id,
      requesterName: 'review the change',
      requesterRole: 'reviewer',
      targetRole: 'implementer',
      purpose: 'repair',
      question: 'restore the dropped null guard',
      gap: 'the failing path was never executed',
      scope: ['apps/desktop/src/store/slices/turn/sendTurn.ts'],
      expectedOutput: 'the guard back with a regression test',
      continuation: 'handoff',
      evidenceRefs: ['review:finding-1'],
      inventoryRevision: 'rabc',
    });
  });

  it('answers nothing for an obligation with no recorded request', () => {
    expect(
      buildNeedRequest({
        obligation: { ...obligation, requests: [] },
        requester,
        requesterRole: 'reviewer',
      }),
    ).toBeNull();
  });
});

describe('buildEvidenceExcerpts', () => {
  it('delivers only the sources the request named', () => {
    expect(buildEvidenceExcerpts({ inventory, evidenceRefs: ['review:finding-1'] })).toEqual([
      inventory.entries[0],
    ]);
  });
});

describe('buildUnresolvedObligations', () => {
  it('names every other open or granted obligation with its owner', () => {
    const other: CapabilityObligation = {
      ...obligation,
      id: 'capability-obligation:agent-2:implementer:repair',
      identity: 'agent-2:implementer:repair',
      state: 'granted',
      ownerAgentId: 'child-9' as AgentId,
    };
    const settled: CapabilityObligation = {
      ...obligation,
      id: 'capability-obligation:agent-3:scout:discovery',
      state: 'satisfied',
    };

    expect(
      buildUnresolvedObligations({
        obligations: [obligation, other, settled],
        agents: [requester, { ...requester, id: 'child-9' as AgentId, name: 'repair the parser' }],
        excludeObligationId: obligation.id,
      }),
    ).toEqual([
      {
        obligationId: other.id,
        identity: 'agent-2:implementer:repair',
        targetRole: 'implementer',
        purpose: 'repair',
        state: 'granted',
        ownerName: 'repair the parser',
      },
    ]);
  });
});
