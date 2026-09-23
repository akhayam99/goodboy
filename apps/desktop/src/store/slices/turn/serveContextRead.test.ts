import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityObligation,
  ProviderRunId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  invokeEvidenceDeliveryRecord: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeEvidenceInventoryRecord: async () => undefined,
  invokeEvidenceDeliveryRecord: h.invokeEvidenceDeliveryRecord,
}));

import { issuedAgentInventory } from './agentEvidenceInventory';
import { contextReadBlocksCompletion, serveContextRead } from './serveContextRead';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

const reviewer: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'review the change',
  kind: 'reviewer',
  status: 'running',
  workflowRunId: 'workflow-run-1' as WorkflowRunId,
};

const obligation = {
  id: 'capability-obligation:agent-1:implementer:repair',
  sessionId: SESSION_ID,
  workflowRunId: 'workflow-run-1' as WorkflowRunId,
  identity: 'agent-1:implementer:repair',
  requesterAgentId: AGENT_ID,
  requesterParentAgentId: null,
  targetRole: 'implementer',
  purpose: 'repair',
  state: 'granted',
  ownerAgentId: 'agent-7' as AgentId,
  decision: 'granted',
  decisionReason: null,
  satisfiedRevision: null,
  childAgentId: 'agent-7' as AgentId,
  deliveredAt: null,
  deliveryReceipt: null,
  requests: [
    {
      id: 'capability-request:agent-1:run-0',
      sessionId: SESSION_ID,
      workflowRunId: 'workflow-run-1' as WorkflowRunId,
      obligationId: 'capability-obligation:agent-1:implementer:repair',
      requesterAgentId: AGENT_ID,
      sourceTurnId: 'run-0',
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
  holdIds: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
} satisfies CapabilityObligation;

const createHarness = () => {
  const sendTurn = vi.fn(async (_args: { readonly content: string }) => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [reviewer] },
    agentKindOverride: {},
    agentTurnState: {},
    capabilityObligations: { [SESSION_ID]: [obligation] },
    sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: 'ship the guard', enabled: true }] },
    sendTurn,
    emitNotification,
  };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, (update as (current: typeof state) => Partial<typeof state>)(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get, sendTurn, emitNotification };
};

const readBody = (fields: Record<string, unknown>): string =>
  `<<context-read>>${JSON.stringify(fields)}<</context-read>>`;

const revisionOf = (get: GetFn): string =>
  issuedAgentInventory({ get, sessionId: SESSION_ID, agentId: AGENT_ID }).inventory.revision;

describe('serveContextRead', () => {
  beforeEach(() => {
    h.invokeEvidenceDeliveryRecord.mockClear();
  });

  it('returns the content of an authorized source and records a receipt without creating an agent', async () => {
    const { set, get, sendTurn } = createHarness();

    const service = await serveContextRead({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: readBody({
        v: 1,
        inventoryRevision: revisionOf(get),
        sources: [{ id: `obligation:${obligation.id}` }],
      }),
    });

    expect(service).toEqual({ kind: 'served', delivered: 1, refused: 0 });
    expect(contextReadBlocksCompletion({ service })).toBe(true);
    expect(h.invokeEvidenceDeliveryRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_ID,
        sourceTurnId: RUN_ID,
        receipts: [
          expect.objectContaining({
            sourceId: `obligation:${obligation.id}`,
            outcome: 'delivered',
          }),
        ],
      }),
    );
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const content = sendTurn.mock.calls[0]?.[0]?.content ?? '';
    expect(content).toContain('retrieved by the host, no agent was created');
    expect(content).toContain('owner agent-7');
  });

  it('refuses an unknown source with a reason and still records the receipt', async () => {
    const { set, get } = createHarness();

    const service = await serveContextRead({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: readBody({
        v: 1,
        inventoryRevision: revisionOf(get),
        sources: [{ id: 'secret:1' }],
      }),
    });

    expect(service).toEqual({ kind: 'served', delivered: 0, refused: 1 });
    expect(h.invokeEvidenceDeliveryRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        receipts: [expect.objectContaining({ sourceId: 'secret:1', outcome: 'unknown-source' })],
      }),
    );
  });

  it('refuses a read formed against a stale inventory revision', async () => {
    const { set, get, emitNotification, sendTurn } = createHarness();

    const service = await serveContextRead({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: readBody({ v: 1, inventoryRevision: 'rstale', sources: ['slot:goal'] }),
    });

    expect(service.kind).toBe('refused');
    expect(contextReadBlocksCompletion({ service })).toBe(false);
    expect(emitNotification).toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
    expect(h.invokeEvidenceDeliveryRecord).not.toHaveBeenCalled();
  });

  it('reports no read for a turn that carries none', async () => {
    const { set, get } = createHarness();

    expect(
      await serveContextRead({
        set,
        get,
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        runId: RUN_ID,
        assistantText: 'the review is finished.',
      }),
    ).toEqual({ kind: 'none' });
  });
});
