import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityGrant,
  CapabilityObligation,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { OrchestratorDecision } from '@goodboy/core';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  claim: vi.fn(),
  update: vi.fn(),
  decide: vi.fn(),
  settle: vi.fn(),
  updateStatus: vi.fn(),
  agentList: vi.fn(),
  claimOwner: vi.fn(),
  workflowUpsert: vi.fn(),
  freeze: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/db', () => ({ claimCapabilityObligationOwner: h.claimOwner }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.agentList,
  invokeAgentUpdateStatus: h.updateStatus,
  invokeCapabilityGrantClaim: h.claim,
  invokeCapabilityGrantUpdate: h.update,
  invokeCapabilityObligationDecide: h.decide,
  invokeCapabilityObligationSettle: h.settle,
  invokeWorkflowUpsert: h.workflowUpsert,
}));
vi.mock('./clusterImplementation', () => ({ freezeClusterExecution: h.freeze }));

import { applyNeedDisposition } from './applyNeedDisposition';

const SESSION_ID = 'session-1' as SessionId;
const REQUESTER_ID = 'agent-1' as AgentId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;

const agentOf = (overrides: Partial<Agent>): Agent => ({
  id: REQUESTER_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'review the change',
  kind: 'reviewer',
  status: 'completed',
  workflowRunId: RUN_ID,
  ...overrides,
});

const obligationOf = (overrides: Partial<CapabilityObligation> = {}): CapabilityObligation => ({
  id: 'capability-obligation:agent-1:implementer:repair',
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  identity: 'agent-1:implementer:repair',
  requesterAgentId: REQUESTER_ID,
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
  holdIds: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const grantOf = (overrides: Partial<CapabilityGrant> = {}): CapabilityGrant => ({
  id: 'capability-grant:capability-obligation:agent-1:implementer:repair',
  obligationId: 'capability-obligation:agent-1:implementer:repair',
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  grantedRole: 'implementer',
  purpose: 'repair',
  continuation: 'handoff',
  parentOutcome: 'handed-off',
  childAgentId: null,
  replacementAgentId: null,
  verificationAgentId: null,
  transferredWork: null,
  state: 'pending',
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const grantDecision = (
  overrides: Partial<{
    readonly role: 'implementer' | 'scout' | 'investigator' | 'planner';
    readonly provider: ProviderId;
  }> = {},
): Extract<OrchestratorDecision, { readonly action: 'need' }> => ({
  action: 'need',
  reason: 'the defect is local, an implementer repairs it',
  obligationId: 'capability-obligation:agent-1:implementer:repair',
  disposition: {
    kind: 'grant',
    step: {
      name: 'repair the guard',
      role: overrides.role ?? 'implementer',
      promptPrefix: 'Restore the guard and cover it.',
      ...(overrides.provider !== undefined && { provider: overrides.provider }),
    },
  },
});

const createHarness = ({ requester }: { readonly requester: Agent }) => {
  const spawnAgent = vi.fn(async () => 'child-1' as AgentId);
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [requester] },
    agentKindOverride: {},
    agentProviderOverride: {},
    capabilityObligations: {} as Record<SessionId, ReadonlyArray<CapabilityObligation>>,
    capabilityGrants: {} as Record<SessionId, ReadonlyArray<CapabilityGrant>>,
    clusterExecutionGraphs: {},
    spawnAgent,
    emitNotification: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, (update as (current: typeof state) => Partial<typeof state>)(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get, spawnAgent };
};

describe('applyNeedDisposition', () => {
  beforeEach(() => {
    Object.values(h).forEach((mock) => mock.mockReset());
    h.claim.mockImplementation(async () => ({ grant: grantOf(), isFirstDelivery: true }));
    h.update.mockImplementation(async () => grantOf({ childAgentId: 'child-1' as AgentId }));
    h.decide.mockImplementation(async () =>
      obligationOf({ state: 'granted', decision: 'granted' }),
    );
    h.settle.mockImplementation(async () => obligationOf({ state: 'satisfied' }));
    h.agentList.mockImplementation(async () => []);
    h.claimOwner.mockImplementation(async () => ({ kind: 'owned' }));
    h.freeze.mockImplementation(async () => null);
  });

  it("grants a reviewer's repair to an implementer and hands the obligation to the run", async () => {
    const requester = agentOf({});
    const { set, get, spawnAgent, state } = createHarness({ requester });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: grantDecision(),
    });

    expect(outcome).toEqual({
      kind: 'granted',
      childAgentId: 'child-1',
      plan: { kind: 'handoff' },
    });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer', executionPurpose: 'capability' }),
    );
    expect(h.claim).toHaveBeenCalledWith(
      expect.objectContaining({ parentOutcome: 'handed-off', grantedRole: 'implementer' }),
    );
    expect(h.claimOwner).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAgentId: 'child-1', childAgentId: 'child-1' }),
    );
    expect(h.updateStatus).not.toHaveBeenCalled();
    expect(state.capabilityGrants[SESSION_ID]).toHaveLength(1);
  });

  it('grants a planner its discovery scout and interrupts the run without touching the template', async () => {
    const requester = agentOf({ kind: 'planner', name: 'plan the migration', status: 'running' });
    const { set, get, spawnAgent } = createHarness({ requester });
    const obligation = obligationOf({
      identity: 'agent-1:scout:discovery',
      targetRole: 'scout',
      purpose: 'discovery',
      requests: [
        {
          ...obligationOf().requests[0]!,
          targetRole: 'scout',
          purpose: 'discovery',
          continuation: 'handoff',
        },
      ],
    });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation,
      decision: { ...grantDecision({ role: 'scout' }), obligationId: obligation.id },
    });

    expect(outcome.kind).toBe('granted');
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'scout', parentAgentId: REQUESTER_ID }),
    );
    expect(h.workflowUpsert).not.toHaveBeenCalled();
  });

  it("routes a tester's production failure to an implementer", async () => {
    const requester = agentOf({ kind: 'tester', name: 'test the change', status: 'completed' });
    const { set, get, spawnAgent } = createHarness({ requester });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: grantDecision(),
    });

    expect(outcome.kind).toBe('granted');
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer' }),
    );
  });

  it('refuses a grant that names a role the requester may not receive', async () => {
    const requester = agentOf({});
    const { set, get, spawnAgent } = createHarness({ requester });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: grantDecision({ role: 'scout' }),
    });

    expect(outcome.kind).toBe('refused');
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: 'refused' }));
  });

  it('continues a resumable parent without ending its attempt', async () => {
    const requester = agentOf({
      kind: 'implementer',
      name: 'apply the change',
      status: 'running',
      providerOverride: 'anthropic',
      providerSessionId: 'sess-1',
      providerSessionProviderId: 'anthropic',
    });
    const { set, get } = createHarness({ requester });
    const obligation = obligationOf({
      targetRole: 'investigator',
      purpose: 'diagnosis',
      identity: 'agent-1:investigator:diagnosis',
      requests: [
        {
          ...obligationOf().requests[0]!,
          targetRole: 'investigator',
          purpose: 'diagnosis',
          continuation: 'resume',
        },
      ],
    });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation,
      decision: {
        ...grantDecision({ role: 'investigator' }),
        obligationId: obligation.id,
      },
    });

    expect(outcome.kind === 'granted' ? outcome.plan.kind : '').toBe('resume');
    expect(h.claim).toHaveBeenCalledWith(expect.objectContaining({ parentOutcome: 'resumed' }));
    expect(h.updateStatus).not.toHaveBeenCalled();
  });

  it('transfers explicitly when the launcher discards the session id', async () => {
    const requester = agentOf({
      kind: 'implementer',
      name: 'apply the change',
      status: 'running',
      providerOverride: 'codex',
      providerSessionId: 'sess-1',
      providerSessionProviderId: 'codex',
      outputSummary: 'the first two files are done',
    });
    const { set, get } = createHarness({ requester });
    const obligation = obligationOf({
      targetRole: 'investigator',
      purpose: 'diagnosis',
      requests: [
        {
          ...obligationOf().requests[0]!,
          targetRole: 'investigator',
          purpose: 'diagnosis',
          continuation: 'resume',
        },
      ],
    });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation,
      decision: { ...grantDecision({ role: 'investigator' }), obligationId: obligation.id },
    });

    expect(outcome.kind === 'granted' ? outcome.plan.kind : '').toBe('transfer');
    expect(h.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        parentOutcome: 'transferred',
        transferredWork: expect.stringContaining('the first two files are done'),
      }),
    );
    expect(h.updateStatus).toHaveBeenCalledWith(
      REQUESTER_ID,
      expect.objectContaining({
        status: 'failed',
        outputSummary: expect.stringContaining('partial, transferred'),
      }),
    );
  });

  it('delivers a grant once, so a reload cannot create a second owner', async () => {
    const requester = agentOf({});
    const { set, get, spawnAgent } = createHarness({ requester });
    h.claim.mockImplementation(async () => ({
      grant: grantOf({ childAgentId: 'child-1' as AgentId, state: 'delivered' }),
      isFirstDelivery: false,
    }));

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: grantDecision(),
    });

    expect(outcome).toEqual({ kind: 'already-delivered' });
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.claimOwner).not.toHaveBeenCalled();
  });

  it('answers a need from existing evidence without creating an agent', async () => {
    const requester = agentOf({});
    const { set, get, spawnAgent } = createHarness({ requester });

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: {
        action: 'need',
        reason: 'the scout report already lists them',
        obligationId: obligationOf().id,
        disposition: { kind: 'reuse', evidenceRefs: ['artifact:report-4'] },
      },
    });

    expect(outcome).toEqual({ kind: 'reused', evidenceRefs: ['artifact:report-4'] });
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.settle).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryReceipt: 'answered from existing evidence: artifact:report-4',
      }),
    );
  });

  it('attaches a second need to the running owner instead of a second agent', async () => {
    const requester = agentOf({});
    const { set, get, spawnAgent } = createHarness({ requester });
    h.decide.mockImplementation(async () =>
      obligationOf({ decision: 'attached', ownerAgentId: 'child-1' as AgentId }),
    );

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf({ ownerAgentId: 'child-1' as AgentId }),
      decision: {
        action: 'need',
        reason: 'the same repair is already running',
        obligationId: obligationOf().id,
        disposition: { kind: 'attach' },
      },
    });

    expect(outcome).toEqual({ kind: 'attached', ownerAgentId: 'child-1' });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('reaches the requester with a refusal and with a refinement, each carrying its reason', async () => {
    const requester = agentOf({});
    const { set, get, state } = createHarness({ requester });
    h.decide.mockImplementation(async () =>
      obligationOf({
        state: 'refused',
        decision: 'refused',
        decisionReason: 'no allowance is left in this run',
      }),
    );

    const refusal = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: {
        action: 'need',
        reason: 'no allowance is left in this run',
        obligationId: obligationOf().id,
        disposition: { kind: 'refuse' },
      },
    });
    expect(refusal).toEqual({ kind: 'refused', reason: 'no allowance is left in this run' });
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.ownerAgentId).toBeNull();
    expect(state.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'need refused: review the change',
      'no allowance is left in this run',
      { sessionId: SESSION_ID },
    );

    h.decide.mockImplementation(async () =>
      obligationOf({ decision: 'refinement', decisionReason: 'name the failing test' }),
    );
    const refinement = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation: obligationOf(),
      decision: {
        action: 'need',
        reason: 'name the failing test',
        obligationId: obligationOf().id,
        disposition: { kind: 'refine' },
      },
    });
    expect(refinement).toEqual({ kind: 'refined', reason: 'name the failing test' });
    expect(h.decide).toHaveBeenLastCalledWith(
      expect.objectContaining({ decision: 'refinement', reason: 'name the failing test' }),
    );
  });
});

describe('a structural escalation', () => {
  beforeEach(() => {
    Object.values(h).forEach((mock) => mock.mockReset());
    h.claim.mockImplementation(async () => ({ grant: grantOf(), isFirstDelivery: true }));
    h.update.mockImplementation(async () => grantOf({ childAgentId: 'child-1' as AgentId }));
    h.decide.mockImplementation(async () =>
      obligationOf({ state: 'granted', decision: 'granted' }),
    );
    h.agentList.mockImplementation(async () => []);
    h.claimOwner.mockImplementation(async () => ({ kind: 'owned' }));
    h.freeze.mockImplementation(async () => null);
  });

  const replanObligation = (overrides: Partial<CapabilityObligation> = {}) =>
    obligationOf({
      identity: 'agent-1:planner:replan',
      targetRole: 'planner',
      purpose: 'replan',
      requests: [
        {
          ...obligationOf().requests[0]!,
          targetRole: 'planner',
          purpose: 'replan',
          question: 'the plan assumed one writer and the work needs two',
        },
      ],
      ...overrides,
    });

  it('freezes the execution the requester belongs to before the planner starts', async () => {
    const requester = agentOf({ parentAgentId: 'container-1' as AgentId });
    const { set, get, spawnAgent } = createHarness({ requester });
    const obligation = replanObligation();
    h.claim.mockImplementation(async () => ({
      grant: grantOf({ purpose: 'replan', grantedRole: 'planner' }),
      isFirstDelivery: true,
    }));

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation,
      decision: { ...grantDecision({ role: 'planner' }), obligationId: obligation.id },
    });

    expect(outcome.kind).toBe('granted');
    expect(h.freeze).toHaveBeenCalledWith(
      expect.objectContaining({ containerId: 'container-1', obligationId: obligation.id }),
    );
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'planner' }),
    );
  });

  it('refuses the escalation once the structural replan allowance is spent', async () => {
    const requester = agentOf({ parentAgentId: 'container-1' as AgentId });
    const { set, get, spawnAgent, state } = createHarness({ requester });
    const obligation = replanObligation();
    state.capabilityGrants = {
      [SESSION_ID]: [
        grantOf({
          id: 'capability-grant:earlier',
          obligationId: 'capability-obligation:earlier',
          purpose: 'replan',
          grantedRole: 'planner',
        }),
      ],
    };
    h.decide.mockImplementation(async () =>
      replanObligation({ state: 'refused', decision: 'refused' }),
    );

    const outcome = await applyNeedDisposition({
      set,
      get,
      sessionId: SESSION_ID,
      obligation,
      decision: { ...grantDecision({ role: 'planner' }), obligationId: obligation.id },
    });

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain(
      'automatic structural replans',
    );
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.freeze).not.toHaveBeenCalled();
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.state).toBe('refused');
  });
});
