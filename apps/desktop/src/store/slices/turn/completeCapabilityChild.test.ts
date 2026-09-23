import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityGrant,
  CapabilityObligation,
  ClusterCompletionHold,
  IsoDateTime,
  SessionId,
  StepId,
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
  decide: vi.fn(),
  adoptRevision: vi.fn(),
  resumeClusters: vi.fn(),
  reopen: vi.fn(),
  needRecord: vi.fn(),
  holdResolve: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.agentList,
  invokeAgentUpdateStatus: h.updateStatus,
  invokeCapabilityGrantUpdate: h.grantUpdate,
  invokeCapabilityObligationSettle: h.settle,
  invokeCapabilityObligationDecide: h.decide,
  invokeCapabilityGrants: h.loadGrants,
  invokeCapabilityObligations: h.loadObligations,
  invokeClusterCompletionHolds: h.loadHolds,
  invokeClusterExecutionGraphs: h.loadGraphs,
  invokeCapabilityObligationReopen: h.reopen,
  invokeCapabilityNeedRecord: h.needRecord,
  invokeClusterCompletionHoldResolve: h.holdResolve,
}));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeStatus: h.worktreeStatus }));
vi.mock('../workflows/summarizeWorkflowAgentOutput', () => ({
  summarizeWorkflowAgentOutput: h.summarize,
}));
vi.mock('../worktrees/getSessionRepo', () => ({
  getSessionRepo: () => ({ worktreePath: '/repo' }),
}));
vi.mock('../workflows/adoptClusterGraphRevision', () => ({
  adoptClusterGraphRevision: h.adoptRevision,
}));
vi.mock('../workflows/clusterImplementation', () => ({
  resumeClusterChildren: h.resumeClusters,
}));

import { completeCapabilityChild, failCapabilityChild } from './completeCapabilityChild';
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
  requesterParentAgentId: null,
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
  const decideCapabilityNeed = vi.fn(async () => ({ kind: 'unavailable', reason: 'stub' }));
  const finalizeWorkflowStep = vi.fn(async () => ({ shouldAutoAdvance: true }));
  const maybeAutoAdvanceWorkflow = vi.fn(async () => undefined);
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    capabilityObligations: { [SESSION_ID]: [obligation] },
    capabilityGrants: { [SESSION_ID]: grant === null ? [] : [grant] },
    clusterCompletionHolds: { [SESSION_ID]: [hold] },
    spawnAgent,
    sendTurn,
    resolveClusterCompletionHold,
    decideCapabilityNeed,
    finalizeWorkflowStep,
    maybeAutoAdvanceWorkflow,
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
  return {
    state,
    set,
    get,
    spawnAgent,
    sendTurn,
    resolveClusterCompletionHold,
    decideCapabilityNeed,
    finalizeWorkflowStep,
    maybeAutoAdvanceWorkflow,
  };
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

const clearVerdict = (id: string): string =>
  `<<cluster-outcome>>{"v":1,"id":"${id}","status":"clear"}<</cluster-outcome>>`;

const unresolvedVerdict = (id: string): string =>
  `<<cluster-outcome>>{"v":1,"id":"${id}","status":"unresolved","findings":[{"reason":"the guard still drops null","target":"implementer"}]}<</cluster-outcome>>`;

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
    h.reopen.mockImplementation(async () =>
      obligationOf({ state: 'open', decision: null, ownerAgentId: null, childAgentId: null }),
    );
    h.needRecord.mockImplementation(async () =>
      obligationOf({ state: 'open', decision: null, ownerAgentId: null, childAgentId: null }),
    );
    h.holdResolve.mockImplementation(async () => undefined);
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
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
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

  it('leaves the obligation open and the successor held when the revision cannot be read', async () => {
    h.worktreeStatus.mockImplementation(async () => {
      throw new Error('git is unavailable');
    });
    const verifier: Agent = {
      ...child,
      id: 'verifier-1' as AgentId,
      name: 'verify repair',
      kind: 'reviewer',
    };
    const { set, get, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf(),
      grant: grantOf({ verificationAgentId: 'verifier-1' as AgentId }),
      agent: verifier,
    });

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: verifier,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(outcome.kind).toBe('unverified');
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  it('closes the grant and the obligation when the granted child fails', async () => {
    h.grantUpdate.mockImplementation(async () => grantOf({ state: 'failed' }));
    h.decide.mockImplementation(async () =>
      obligationOf({ state: 'refused', decision: 'refused' }),
    );
    const { set, get, state, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf(),
      grant: grantOf(),
    });

    const reconciled = await failCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      agentId: CHILD_ID,
      message: 'the provider exited',
    });

    expect(reconciled).toBe(true);
    expect(h.grantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID, state: 'failed' }),
    );
    expect(h.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        obligationId: OBLIGATION_ID,
        decision: 'refused',
        reason: expect.stringContaining('the provider exited'),
      }),
    );
    expect(state.capabilityGrants[SESSION_ID]?.[0]?.state).toBe('failed');
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.state).toBe('refused');
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  const verifierAgent: Agent = {
    ...child,
    id: 'verifier-1' as AgentId,
    name: 'verify repair',
    kind: 'reviewer',
  };

  const completeVerifier = async ({ assistantText }: { readonly assistantText: string }) => {
    const harness = createHarness({
      obligation: obligationOf(),
      grant: grantOf({ verificationAgentId: verifierAgent.id }),
      agent: verifierAgent,
    });
    h.agentList.mockImplementation(async () => [verifierAgent]);
    const outcome = await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText,
      now,
    });
    return { ...harness, outcome };
  };

  it('asks the focused verifier for a verdict that names its own id', async () => {
    const { set, get, sendTurn } = createHarness({
      obligation: obligationOf(),
      grant: grantOf(),
    });

    await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child,
      assistantText: 'the guard is restored.',
      now,
    });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'verifier-1',
        content: expect.stringContaining('<<cluster-outcome>>{"v":1,"id":"verifier-1"'),
      }),
    );
  });

  it('keeps the obligation open and releases nothing when the verifier reports unresolved findings', async () => {
    const { outcome, resolveClusterCompletionHold, decideCapabilityNeed, state } =
      await completeVerifier({
        assistantText: `the guard is still gone.\n${unresolvedVerdict('verifier-1')}`,
      });

    expect(outcome.kind).toBe('verification-rejected');
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
    expect(h.holdResolve).not.toHaveBeenCalled();
    expect(h.grantUpdate).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed' }));
    expect(h.reopen).toHaveBeenCalledWith(expect.objectContaining({ obligationId: OBLIGATION_ID }));
    expect(h.needRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        obligationId: OBLIGATION_ID,
        gap: expect.stringContaining('the guard still drops null'),
      }),
    );
    expect(decideCapabilityNeed).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.state).toBe('open');
  });

  it('never settles on a verifier that gave no verdict', async () => {
    const { outcome, resolveClusterCompletionHold } = await completeVerifier({
      assistantText: 'the repair holds.',
    });

    expect(outcome).toEqual({
      kind: 'verification-rejected',
      reason: 'the verifier gave no verdict',
    });
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  it('never settles on a verdict that names another agent', async () => {
    const { outcome } = await completeVerifier({
      assistantText: `the repair holds.\n${clearVerdict('child-1')}`,
    });

    expect(outcome.kind).toBe('verification-rejected');
    expect(h.settle).not.toHaveBeenCalled();
  });

  it('settles and releases on a clear verdict from the verifier itself', async () => {
    const { outcome, resolveClusterCompletionHold } = await completeVerifier({
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
    });

    expect(outcome).toEqual({ kind: 'settled', verifiedRevision: 'sha-verified' });
    expect(h.settle).toHaveBeenCalledTimes(1);
    expect(h.reopen).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-1' }),
    );
  });

  it('finishes the step of a phase requester once the work it handed off is verified', async () => {
    const stepRequester: Agent = {
      ...child,
      id: REQUESTER_ID,
      name: 'review the change',
      kind: 'reviewer',
      parentAgentId: undefined,
      executionPurpose: undefined,
      stepId: 'step-review' as StepId,
    };
    h.settle.mockImplementation(async () =>
      obligationOf({ state: 'satisfied', satisfiedRevision: 'sha-verified', holdIds: [] }),
    );
    h.agentList.mockImplementation(async () => [verifierAgent, stepRequester]);
    const harness = createHarness({
      obligation: obligationOf({ holdIds: [] }),
      grant: grantOf({ verificationAgentId: verifierAgent.id }),
      agent: verifierAgent,
    });

    const outcome = await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(outcome).toEqual({ kind: 'settled', verifiedRevision: 'sha-verified' });
    expect(harness.finalizeWorkflowStep).toHaveBeenCalledWith(
      SESSION_ID,
      REQUESTER_ID,
      expect.stringContaining('verified it'),
      false,
      { force: true },
    );
    expect(harness.maybeAutoAdvanceWorkflow).toHaveBeenCalledWith(SESSION_ID);
  });

  it('leaves a held cluster requester to its hold instead of finishing a step', async () => {
    const { finalizeWorkflowStep } = await completeVerifier({
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
    });

    expect(finalizeWorkflowStep).not.toHaveBeenCalled();
  });

  it('leaves the node open for a resumed requester and lets its own completion close it', async () => {
    const investigator: Agent = { ...child, name: 'diagnose the failure', kind: 'debugger' };
    const { set, get, resolveClusterCompletionHold } = createHarness({
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

    await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: investigator,
      assistantText: 'the cause is the missing guard.',
      now,
    });

    expect(h.holdResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'hold-1' }));
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  const resumedRepair = () => ({
    obligation: obligationOf({
      requests: [
        {
          id: 'capability-request:agent-1:run-1',
          sessionId: SESSION_ID,
          workflowRunId: RUN_ID,
          obligationId: OBLIGATION_ID,
          requesterAgentId: REQUESTER_ID,
          sourceTurnId: 'run-1',
          targetRole: 'implementer',
          purpose: 'repair',
          question: 'restore the dropped guard',
          scope: [],
          evidenceRefs: ['review:finding-1'],
          gap: 'the failing path was never executed',
          expectedOutput: 'the guard back',
          continuation: 'resume',
          routingProposal: null,
          inventoryRevision: 'rabc',
          createdAt: '2026-07-30T00:00:00.000Z',
        },
      ],
    }),
    grant: grantOf({
      continuation: 'resume',
      parentOutcome: 'resumed',
      verificationAgentId: 'verifier-1' as AgentId,
    }),
  });

  const requesterTurns = (sendTurn: ReturnType<typeof vi.fn>) =>
    sendTurn.mock.calls.filter(
      (call) => (call[0] as { readonly agentId: AgentId }).agentId === REQUESTER_ID,
    );

  it('resumes the requester once its repair is verified, and only once across a reload', async () => {
    const { obligation, grant } = resumedRepair();
    const harness = await createReloadedHarness({ obligation, grant, agent: verifierAgent });
    h.agentList.mockImplementation(async () => [verifierAgent]);

    const outcome = await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(outcome).toEqual({ kind: 'parent-resumed' });
    expect(requesterTurns(harness.sendTurn)).toHaveLength(1);
    const content = (requesterTurns(harness.sendTurn)[0]?.[0] as { readonly content: string })
      .content;
    expect(content).toContain('sha-verified');
    expect(content).toContain('review:finding-1');
    expect(harness.resolveClusterCompletionHold).not.toHaveBeenCalled();

    h.loadObligations.mockImplementation(async () => [
      { ...obligation, state: 'satisfied', satisfiedRevision: 'sha-verified' },
    ]);
    h.loadGrants.mockImplementation(async () => [{ ...grant, state: 'settled' }]);
    await loadPhaseRunsForSession(harness.set)(SESSION_ID);
    const again = await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(again.kind).toBe('inactive');
    expect(requesterTurns(harness.sendTurn)).toHaveLength(1);
    expect(h.settle).toHaveBeenCalledTimes(1);
  });

  it('never resumes the requester on a verdict that is not clear', async () => {
    const { obligation, grant } = resumedRepair();
    const harness = createHarness({ obligation, grant, agent: verifierAgent });
    h.agentList.mockImplementation(async () => [verifierAgent]);

    await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText: `the guard is still gone.\n${unresolvedVerdict('verifier-1')}`,
      now,
    });

    expect(requesterTurns(harness.sendTurn)).toHaveLength(0);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it('never resumes the requester under a cancelled or failed grant', async () => {
    const { obligation, grant } = resumedRepair();
    for (const state of ['cancelled', 'failed'] as const) {
      const harness = createHarness({
        obligation,
        grant: { ...grant, state },
        agent: verifierAgent,
      });
      h.agentList.mockImplementation(async () => [verifierAgent]);

      const outcome = await completeCapabilityChild({
        set: harness.set,
        get: harness.get,
        sessionId: SESSION_ID,
        child: verifierAgent,
        assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
        now,
      });

      expect(outcome.kind).toBe('inactive');
      expect(requesterTurns(harness.sendTurn)).toHaveLength(0);
    }
    expect(h.settle).not.toHaveBeenCalled();
  });

  it('never resumes the requester of a refused obligation', async () => {
    const { obligation, grant } = resumedRepair();
    const harness = createHarness({
      obligation: { ...obligation, state: 'refused', decision: 'refused' },
      grant,
      agent: verifierAgent,
    });
    h.agentList.mockImplementation(async () => [verifierAgent]);

    const outcome = await completeCapabilityChild({
      set: harness.set,
      get: harness.get,
      sessionId: SESSION_ID,
      child: verifierAgent,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(outcome.kind).toBe('inactive');
    expect(requesterTurns(harness.sendTurn)).toHaveLength(0);
  });

  it('adopts the revision a replan delivered and releases the held successor', async () => {
    const planner: Agent = { ...child, name: 'replan the cluster', kind: 'planner' };
    const requester: Agent = {
      ...child,
      id: REQUESTER_ID,
      name: 'review the change',
      kind: 'reviewer',
      parentAgentId: 'container-1' as AgentId,
    };
    const { set, get, spawnAgent, resolveClusterCompletionHold, state } = createHarness({
      obligation: obligationOf({ purpose: 'replan', targetRole: 'planner' }),
      grant: grantOf({ purpose: 'replan', grantedRole: 'planner' }),
      agent: planner,
    });
    state.sessionPhaseRuns = { [SESSION_ID]: [planner, requester] };
    h.agentList.mockImplementation(async () => [planner, requester]);
    h.settle.mockImplementation(async () =>
      obligationOf({ purpose: 'replan', state: 'satisfied', satisfiedRevision: 'sha-verified' }),
    );
    h.adoptRevision.mockImplementation(async () => ({
      kind: 'adopted',
      revision: 2,
      superseded: ['impl'],
      quarantined: [],
      appended: ['impl-split'],
    }));

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: planner,
      assistantText: '<<plan-revision>>{"baseRevision":1,"nodes":[]}<</plan-revision>>',
      now,
    });

    expect(outcome).toEqual({ kind: 'revision-adopted', revision: 2 });
    expect(h.adoptRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        containerAgentId: 'container-1',
        obligationId: OBLIGATION_ID,
        proposalText: '<<plan-revision>>{"baseRevision":1,"nodes":[]}<</plan-revision>>',
      }),
    );
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-1' }),
    );
  });

  it('leaves the old graph frozen and the finding open when the revision is refused', async () => {
    const planner: Agent = { ...child, name: 'replan the cluster', kind: 'planner' };
    const requester: Agent = {
      ...child,
      id: REQUESTER_ID,
      name: 'review the change',
      kind: 'reviewer',
      parentAgentId: 'container-1' as AgentId,
    };
    const { set, get, resolveClusterCompletionHold, state } = createHarness({
      obligation: obligationOf({ purpose: 'replan', targetRole: 'planner' }),
      grant: grantOf({ purpose: 'replan', grantedRole: 'planner' }),
      agent: planner,
    });
    state.sessionPhaseRuns = { [SESSION_ID]: [planner, requester] };
    h.agentList.mockImplementation(async () => [planner, requester]);
    h.adoptRevision.mockImplementation(async () => ({
      kind: 'refused',
      reason: 'the proposal was formed against revision 1',
    }));
    h.decide.mockImplementation(async () =>
      obligationOf({
        purpose: 'replan',
        state: 'refused',
        decision: 'refused',
        decisionReason: 'the proposal was formed against revision 1',
      }),
    );
    h.grantUpdate.mockImplementation(async () =>
      grantOf({ purpose: 'replan', grantedRole: 'planner', state: 'failed' }),
    );

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: planner,
      assistantText: 'a stale revision.',
      now,
    });

    expect(outcome).toEqual({
      kind: 'revision-refused',
      reason: 'the proposal was formed against revision 1',
    });
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
    expect(h.decide).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID, decision: 'refused' }),
    );
    expect(state.capabilityObligations[SESSION_ID]?.[0]?.state).toBe('refused');
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
      expect.objectContaining({ kindOverride: 'implementer', obligationId: OBLIGATION_ID }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
  });

  const transferredGrant = (overrides: Partial<CapabilityGrant> = {}): CapabilityGrant =>
    grantOf({
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
      ...overrides,
    });

  it('keeps the successor held while the replacement of transferred work still runs', async () => {
    const scout: Agent = { ...child, name: 'map the callers', kind: 'scout' };
    const { set, get, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf({ purpose: 'discovery', targetRole: 'scout' }),
      grant: transferredGrant(),
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

    expect(outcome.kind).toBe('replacement-started');
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  it('sends a finished replacement to a focused verification instead of releasing on its claim', async () => {
    const replacement: Agent = {
      ...child,
      id: 'replacement-1' as AgentId,
      name: 'resume the transferred work',
      kind: 'implementer',
    };
    const { set, get, spawnAgent, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf({ purpose: 'discovery', targetRole: 'scout' }),
      grant: transferredGrant({ replacementAgentId: replacement.id }),
      agent: replacement,
    });
    h.agentList.mockImplementation(async () => [replacement]);

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: replacement,
      assistantText: 'the rest of the cluster is done.',
      now,
    });

    expect(outcome).toEqual({ kind: 'verification-started', verifierAgentId: 'verifier-1' });
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'reviewer', parentAgentId: REQUESTER_ID }),
    );
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
  });

  it('releases the successor once the transferred work passes its verification', async () => {
    const verifier: Agent = {
      ...child,
      id: 'verifier-2' as AgentId,
      name: 'verify the transferred work',
      kind: 'reviewer',
    };
    const { set, get, spawnAgent, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf({ purpose: 'discovery', targetRole: 'scout' }),
      grant: transferredGrant({
        replacementAgentId: 'replacement-1' as AgentId,
        verificationAgentId: verifier.id,
      }),
      agent: verifier,
    });
    h.agentList.mockImplementation(async () => [verifier]);

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: verifier,
      assistantText: `the transferred work holds.\n${clearVerdict('verifier-2')}`,
      now,
    });

    expect(outcome).toEqual({ kind: 'settled', verifiedRevision: 'sha-verified' });
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(h.settle).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID, verifiedRevision: 'sha-verified' }),
    );
    expect(resolveClusterCompletionHold).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, holdId: 'hold-1' }),
    );
  });

  it('hands a verified repair of a transferred requester to a replacement before releasing', async () => {
    const verifier: Agent = {
      ...child,
      id: 'verifier-1' as AgentId,
      name: 'verify repair',
      kind: 'reviewer',
    };
    const { set, get, spawnAgent, resolveClusterCompletionHold } = createHarness({
      obligation: obligationOf(),
      grant: transferredGrant({
        purpose: 'repair',
        grantedRole: 'implementer',
        verificationAgentId: verifier.id,
      }),
      agent: verifier,
    });
    h.agentList.mockImplementation(async () => [verifier]);

    const outcome = await completeCapabilityChild({
      set,
      get,
      sessionId: SESSION_ID,
      child: verifier,
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
      now,
    });

    expect(outcome.kind).toBe('replacement-started');
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'implementer' }),
    );
    expect(h.settle).not.toHaveBeenCalled();
    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();
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
      assistantText: `the repair holds.\n${clearVerdict('verifier-1')}`,
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
