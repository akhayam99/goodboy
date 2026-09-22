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
  invokeCapabilityNeedRecord: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentGenerationReserve: async ({ count }: { readonly count: number }) => ({
    kind: 'granted' as const,
    reservations: Array.from({ length: count }, (_, index) => ({
      reservationId: `reservation:${index}`,
      depth: 1,
      causalRootAgentId: null,
    })),
  }),
  invokeAgentGenerationBind: async () => undefined,
  invokeEvidenceInventoryRecord: async () => undefined,
  invokeEvidenceDeliveryRecord: async () => undefined,
  invokeCapabilityNeedRecord: h.invokeCapabilityNeedRecord,
}));

import { captureCapabilityNeed, needBlocksCompletion } from './captureCapabilityNeed';
import { issuedAgentInventory } from './agentEvidenceInventory';

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

const needBody = (fields: Record<string, unknown>): string =>
  `<<need>>${JSON.stringify(fields)}<</need>>`;

const revisionOf = (get: GetFn): string =>
  issuedAgentInventory({ get, sessionId: SESSION_ID, agentId: AGENT_ID }).inventory.revision;

const repairNeed = {
  v: 1,
  agent: AGENT_ID,
  target: 'implementer',
  purpose: 'repair',
  question: 'restore the dropped null guard',
  scope: ['apps/desktop/src/store/slices/turn/sendTurn.ts'],
  evidence: ['review:finding-1'],
  gap: 'the failing path was never executed',
  expectedOutput: 'the guard back with a regression test',
  continuation: 'handoff',
};

const obligation = {
  id: 'capability-obligation:agent-1:implementer:repair',
  sessionId: SESSION_ID,
  workflowRunId: 'workflow-run-1' as WorkflowRunId,
  identity: 'agent-1:implementer:repair',
  requesterAgentId: AGENT_ID,
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
  requests: [],
  holdIds: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
} satisfies CapabilityObligation;

const createHarness = () => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [reviewer] },
    agentKindOverride: {},
    capabilityObligations: {} as Record<SessionId, ReadonlyArray<CapabilityObligation>>,
    sessions: [],
    providers: [],
    agentProviderOverride: {},
    sessionSlots: {},
    emitNotification: vi.fn(async () => undefined),
    decideCapabilityNeed: vi.fn(async () => ({ kind: 'unavailable', reason: 'stub' })),
  };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, (update as (current: typeof state) => Partial<typeof state>)(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

describe('captureCapabilityNeed', () => {
  beforeEach(() => {
    h.invokeCapabilityNeedRecord.mockReset();
    h.invokeCapabilityNeedRecord.mockImplementation(async () => obligation);
  });

  it('captures a need emitted beside a cluster boundary marker', async () => {
    const { state, set, get } = createHarness();

    const capture = await captureCapabilityNeed({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: `${needBody({ ...repairNeed, inventoryRevision: revisionOf(get) })}\n<<cluster-done id="${AGENT_ID}">>`,
    });

    expect(capture).toEqual({ kind: 'captured', obligationId: obligation.id });
    expect(h.invokeCapabilityNeedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: `capability-request:${AGENT_ID}:${RUN_ID}`,
        identity: 'agent-1:implementer:repair',
        sourceTurnId: RUN_ID,
        targetRole: 'implementer',
        purpose: 'repair',
        continuation: 'handoff',
      }),
    );
    expect(state.capabilityObligations[SESSION_ID]).toEqual([obligation]);
    expect(needBlocksCompletion({ capture })).toBe(true);
    expect(state.decideCapabilityNeed).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      obligationId: obligation.id,
    });
  });

  it('refuses a need that names another agent and records no obligation', async () => {
    const { state, set, get } = createHarness();

    const capture = await captureCapabilityNeed({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: needBody({
        ...repairNeed,
        agent: 'agent-9',
        inventoryRevision: revisionOf(get),
      }),
    });

    expect(capture.kind).toBe('rejected');
    expect(needBlocksCompletion({ capture })).toBe(false);
    expect(state.decideCapabilityNeed).not.toHaveBeenCalled();
    expect(h.invokeCapabilityNeedRecord).not.toHaveBeenCalled();
    expect(state.capabilityObligations[SESSION_ID]).toBeUndefined();
  });

  it('refuses a target and purpose the requester role does not grant', async () => {
    const { set, get } = createHarness();

    const capture = await captureCapabilityNeed({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: needBody({
        ...repairNeed,
        target: 'scout',
        purpose: 'discovery',
        inventoryRevision: revisionOf(get),
      }),
    });

    expect(capture).toEqual({
      kind: 'rejected',
      reason: 'a reviewer may not request scout for discovery',
    });
    expect(h.invokeCapabilityNeedRecord).not.toHaveBeenCalled();
  });

  it('reports no need for a turn that carries none', async () => {
    const { set, get } = createHarness();

    expect(
      await captureCapabilityNeed({
        set,
        get,
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        runId: RUN_ID,
        assistantText: 'the review is finished.',
      }),
    ).toEqual({ kind: 'none' });
  });

  it('refuses a need formed against a stale inventory revision', async () => {
    const { state, set, get } = createHarness();

    const capture = await captureCapabilityNeed({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      runId: RUN_ID,
      assistantText: needBody({ ...repairNeed, inventoryRevision: 'rstale' }),
    });

    expect(capture.kind).toBe('rejected');
    expect(capture.kind === 'rejected' ? capture.reason : '').toContain('inventory revision');
    expect(h.invokeCapabilityNeedRecord).not.toHaveBeenCalled();
    expect(state.capabilityObligations[SESSION_ID]).toBeUndefined();
  });
});
