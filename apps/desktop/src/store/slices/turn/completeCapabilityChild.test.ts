import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityGrant,
  CapabilityObligation,
  ClusterCompletionHold,
  IsoDateTime,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  agentList: vi.fn(),
  updateStatus: vi.fn(),
  grantUpdate: vi.fn(),
  settle: vi.fn(),
  worktreeStatus: vi.fn(),
  summarize: vi.fn(),
  loadGrants: vi.fn(),
  loadObligations: vi.fn(),
  loadHolds: vi.fn(),
  loadGraphs: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.agentList,
  invokeAgentUpdateStatus: h.updateStatus,
  invokeCapabilityGrantUpdate: h.grantUpdate,
  invokeCapabilityObligationSettle: h.settle,
  invokeCapabilityGrants: h.loadGrants,
  invokeCapabilityObligations: h.loadObligations,
  invokeClusterCompletionHolds: h.loadHolds,
  invokeClusterExecutionGraphs: h.loadGraphs,
}));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));
vi.mock('../workflows/summarizeWorkflowAgentOutput', () => ({
  summarizeWorkflowAgentOutput: h.summarize,
}));
vi.mock('../worktrees/getSessionRepo', () => ({
  getSessionRepo: () => ({ worktreePath: '/repo' }),
}));

import { completeCapabilityChild } from './completeCapabilityChild';
import { loadPhaseRunsForSession } from '../workflows/loadPhaseRunsForSession';

const SESSION_ID = 'session-1' as SessionId;
const REQUESTER_ID = 'agent-1' as AgentId;
const CHILD_ID = 'child-1' as AgentId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;
const OBLIGATION_ID = 'capability-obligation:agent-1:implementer:repair';
const now = (): IsoDateTime => '2026-07-30T00:00:00.000Z' as IsoDateTime;

const child: Agent = {
  id: CHILD_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'repair the guard',
  kind: 'implementer',
  status: 'running',
  workflowRunId: RUN_ID,
  parentAgentId: REQUESTER_ID,
  executionPurpose: 'capability',
};

const obligationOf = (overrides: Partial<CapabilityObligation> = {}): CapabilityObligation => ({
  id: OBLIGATION_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  identity: 'agent-1:implementer:repair',
  requesterAgentId: REQUESTER_ID,
  targetRole: 'implementer',
  purpose: 'repair',
  state: 'granted',
  ownerAgentId: CHILD_ID,
  decision: 'granted',
  decisionReason: null,
  satisfiedRevision: null,
  childAgentId: CHILD_ID,
  deliveredAt: null,
  deliveryReceipt: null,
  requests: [],
  holdIds: ['hold-1'],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const grantOf = (overrides: Partial<CapabilityGrant> = {}): CapabilityGrant => ({
  id: `capability-grant:${OBLIGATION_ID}`,
  obligationId: OBLIGATION_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  grantedRole: 'implementer',
  purpose: 'repair',
  continuation: 'handoff',
  parentOutcome: 'handed-off',
  childAgentId: CHILD_ID,
  replacementAgentId: null,
  verificationAgentId: null,
  transferredWork: null,
  state: 'delivered',
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const hold: ClusterCompletionHold = {
  id: 'hold-1',
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  containerAgentId: 'container-1' as AgentId,
  sourceAgentId: REQUESTER_ID,
  sourceTurnId: 'run-1',
  reason: 'unresolved-outcome',
  findings: [{ reason: 'the guard is gone', target: 'implementer' }],
  state: 'open',
  resolutionEvidence: null,
  resolvedAt: null,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

type HarnessParams = {
  readonly obligation: CapabilityObligation;
  readonly grant: CapabilityGrant | null;
  readonly agent?: Agent;
};

const createHarness = ({ obligation, grant, agent = child }: HarnessParams) => {
  const spawnAgent = vi.fn(async () => 'verifier-1' as AgentId);
  const sendTurn = vi.fn(async () => undefined);
  const resolveClusterCompletionHold = vi.fn(async () => undefined);
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    capabilityObligations: { [SESSION_ID]: [obligation] },
    capabilityGrants: { [SESSION_ID]: grant === null ? [] : [grant] },
    clusterCompletionHolds: { [SESSION_ID]: [hold] },
    spawnAgent,
    sendTurn,
    resolveClusterCompletionHold,
    refreshUnreadWorkspaces: vi.fn(),
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
  return { state, set, get, spawnAgent, sendTurn, resolveClusterCompletionHold };
};

const createReloadedHarness = async ({ obligation, grant, agent = child }: HarnessParams) => {
  const harness = createHarness({ obligation, grant, agent });
  Object.assign(harness.state, {
    sessionPhaseRuns: {},
    capabilityObligations: {},
    capabilityGrants: {},
    clusterCompletionHolds: {},
  });
  h.agentList.mockImplementation(async () => [agent]);
  h.loadObligations.mockImplementation(async () => [obligation]);
  h.loadGrants.mockImplementation(async () => (grant === null ? [] : [grant]));
  await loadPhaseRunsForSession(harness.set)(SESSION_ID);
  return harness;
};

describe('completeCapabilityChild', () => {
  beforeEach(() => {
    Object.values(h).forEach((mock) => mock.mockReset());
    h.agentList.mockImplementation(async () => [child]);
    h.summarize.mockImplementation(async () => 'the guard is back and covered');
    h.loadHolds.mockImplementation(async () => [hold]);
    h.loadGraphs.mockImplementation(async () => []);
    h.loadObligations.mockImplementation(async () => []);
    h.loadGrants.mockImplementation(async () => []);
    h.worktreeStatus.mockImplementation(async () => ({ head: 'sha-verified' }));
    h.grantUpdate.mockImplementation(async () =>
      grantOf({ verificationAgentId: 'verifier-1' as AgentId }),
    );
    h.settle.mockImplementation(async () =>
      obligationOf({
        state: 'satisfied',
        satisfiedRevision: 'sha-verified',
        deliveryReceipt: 'repair verified',
      }),
    );
  });

  it('sends a finished repair to a focused verification instead of closing on its claim', async () => {
    const { set, get, spawnAgent, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf(),
      grant: grantOf(),
    });

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child,
      assistantText: 'the guard is restored.',
      now,
    });

    expect(outcome).toEqual({ kind: 'verification-started', verifierAgentId: 'verifier-1' });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'reviewer', executionPurpose: 'capability' }),
    );
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  it('never routes the verification back to the agent that requested the repair', async () => {
    const { set, get, spawnAgent } = createHarness({
      obligation: obligationOf(),
      grant: grantOf(),
    });

    await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child,
      assistantText: 'done.',
      now,
    });

    expect(spawnAgent).not.toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer' }),
    );
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'reviewer' }),
    );
  });

  it('closes the obligation against the verified revision and releases the successor', async () => {
    const verifier: Agent = {
      ...child,
      id: 'verifier-1' as AgentId,
      name: 'verify repair',
      kind: 'reviewer',
    };
    const { set, get, resolveClusterCompletionHold, state } = createHarness({
      obligation: obligationOf(),
      grant: grantOf({ verificationAgentId: 'verifier-1' as AgentId }),
      agent: verifier,
    });

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: verifier,
      assistantText: 'the repair holds.',
      now,
    });

    expect(outcome).toEqual({ kind: 'settled', verifiedRevision: 'sha-verified' });
    expect(h.settle).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID, verifiedRevision: 'sha-verified' }),
    );
    expect(resolveClusterCompletionHold).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, holdId: 'hold-1' }),
    );
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.state).toBe('satisfied');
  });

  it('leaves the active graph frozen when a replan reports back', async () => {
    const planner: Agent = { ...child, name: 'replan the cluster', kind: 'planner' };
    const { set, get, spawnAgent, state } = createHarness({
      obligation: obligationOf({ purpose: 'replan', targetRole: 'planner' }),
      grant: grantOf({ purpose: 'replan', grantedRole: 'planner' }),
      agent: planner,
    });
    h.settle.mockImplementation(async () =>
      obligationOf({ purpose: 'replan', state: 'satisfied', satisfiedRevision: 'sha-verified' }),
    );

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: planner,
      assistantText: 'a revised plan follows.',
      now,
    });

    expect(outcome).toEqual({ kind: 'proposal-pending' });
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'replan proposal pending: replan the cluster',
      expect.stringContaining('stays frozen'),
      { sessionId: SESSION_ID },
    );
  });

  it('resumes a parent only under a grant that recorded a resumption', async () => {
    const investigator: Agent = { ...child, name: 'diagnose the failure', kind: 'debugger' };
    const { set, get, sendTurn } = createHarness({
      obligation: obligationOf({ purpose: 'diagnosis', targetRole: 'investigator' }),
      grant: grantOf({
        purpose: 'diagnosis',
        grantedRole: 'investigator',
        continuation: 'resume',
        parentOutcome: 'resumed',
      }),
      agent: investigator,
    });
    h.settle.mockImplementation(async () =>
      obligationOf({ purpose: 'diagnosis', state: 'satisfied' }),
    );

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: investigator,
      assistantText: 'the cause is the missing guard.',
      now,
    });

    expect(outcome).toEqual({ kind: 'parent-resumed' });
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, agentId: REQUESTER_ID }),
    );
  });

  it('hands transferred work to a replacement rather than back to the ended parent', async () => {
    const scout: Agent = { ...child, name: 'map the callers', kind: 'scout' };
    const { set, get, spawnAgent, sendTurn } = createHarness({
      obligation: obligationOf({ purpose: 'discovery', targetRole: 'scout' }),
      grant: grantOf({
        purpose: 'discovery',
        grantedRole: 'scout',
        continuation: 'transfer',
        parentOutcome: 'transferred',
        transferredWork: JSON.stringify({
          replacementRole: 'implementer',
          completedWork: 'two files done',
          remainingCriteria: 'the rest of the cluster',
          evidenceRefs: [],
          executionTarget: null,
        }),
      }),
      agent: scout,
    });
    h.settle.mockImplementation(async () =>
      obligationOf({ purpose: 'discovery', state: 'satisfied' }),
    );

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: scout,
      assistantText: 'the callers are listed.',
      now,
    });

    expect(outcome).toEqual({ kind: 'replacement-started', replacementAgentId: 'verifier-1' });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer' }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('verifies and settles a repair whose child reports back only after a reload', async () => {
    const { set, get, spawnAgent, state } = await createReloadedHarness({
      obligation: obligationOf(),
      grant: grantOf(),
    });

    expect(state.capabilityGrants[SESSION_ID]).toHaveLength(1);

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child,
      assistantText: 'the guard is restored.',
      now,
    });

    expect(outcome).toEqual({ kind: 'verification-started', verifierAgentId: 'verifier-1' });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'reviewer', executionPurpose: 'capability' }),
    );

    const verifier: Agent = {
      ...child,
      id: 'verifier-1' as AgentId,
      name: 'verify repair',
      kind: 'reviewer',
    };
    h.agentList.mockImplementation(async () => [verifier]);

    const settled = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: verifier,
      assistantText: 'the repair holds.',
      now,
    });

    expect(settled).toEqual({ kind: 'settled', verifiedRevision: 'sha-verified' });
    expect(h.settle).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID, verifiedRevision: 'sha-verified' }),
    );
  });

  it('hands transferred work to a replacement when the child reports back after a reload', async () => {
    const scout: Agent = { ...child, name: 'map the callers', kind: 'scout' };
    h.settle.mockImplementation(async () =>
      obligationOf({ purpose: 'discovery', state: 'satisfied' }),
    );
    const { set, get, spawnAgent, sendTurn } = await createReloadedHarness({
      obligation: obligationOf({ purpose: 'discovery', targetRole: 'scout' }),
      grant: grantOf({
        purpose: 'discovery',
        grantedRole: 'scout',
        continuation: 'transfer',
        parentOutcome: 'transferred',
        transferredWork: JSON.stringify({
          replacementRole: 'implementer',
          completedWork: 'two files done',
          remainingCriteria: 'the rest of the cluster',
          evidenceRefs: [],
          executionTarget: null,
        }),
      }),
      agent: scout,
    });

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: scout,
      assistantText: 'the callers are listed.',
      now,
    });

    expect(outcome).toEqual({ kind: 'replacement-started', replacementAgentId: 'verifier-1' });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer' }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('never resumes a parent for a child whose delivery is gone', async () => {
    const { set, get, sendTurn, spawnAgent } = createHarness({
      obligation: obligationOf(),
      grant: null,
    });

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child,
      assistantText: 'cancelled midway.',
      now,
    });

    expect(outcome).toEqual({ kind: 'unbound' });
    expect(sendTurn).not.toHaveBeenCalled();
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.settle).not.toHaveBeenCalled();
  });
});
