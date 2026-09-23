import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityGrant,
  CapabilityObligation,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  decide: vi.fn(),
  countAttempts: vi.fn(),
  agentById: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    OrchestratorClient: class {
      decide = h.decide;
    },
  };
});
vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return { ...actual, countObligationAttempts: h.countAttempts, getAgentById: h.agentById };
});
vi.mock('./applyNeedDisposition', () => ({ applyNeedDisposition: h.apply }));
vi.mock('../worktrees/getSessionRepo', () => ({ getSessionRepo: () => null }));
vi.mock('./buildNeedPacket', () => ({
  buildNeedRequest: () => ({ evidenceRefs: [] }),
  buildEvidenceExcerpts: () => [],
  buildUnresolvedObligations: () => [],
}));

import { decideCapabilityNeed } from './decideCapabilityNeed';

const SESSION_ID = 'session-1' as SessionId;
const REQUESTER_ID = 'agent-1' as AgentId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;
const OBLIGATION_ID = 'capability-obligation:agent-1:implementer:repair';

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
  id: OBLIGATION_ID,
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
  requests: [],
  holdIds: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

const failedGrant: CapabilityGrant = {
  id: `capability-grant:${OBLIGATION_ID}`,
  obligationId: OBLIGATION_ID,
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
  state: 'failed',
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

const createHarness = () => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [requester] },
    sessions: [
      {
        id: SESSION_ID,
        goal: 'restore the guard',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic' },
        workflowRuns: [],
      },
    ],
    capabilityObligations: { [SESSION_ID]: [obligation] },
    capabilityGrants: { [SESSION_ID]: [failedGrant] },
    clusterExecutionGraphs: {},
    providers: [],
    providerCooldowns: {},
    budgetAlerts: [],
    workspaceOverrides: {},
    agentKindOverride: {},
    transcripts: {},
    sessionPlans: {},
    sessionArtifacts: {},
    emitNotification: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    Object.assign(
      state,
      typeof update === 'function' ? (update as (current: typeof state) => object)(state) : update,
    );
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { set, get };
};

const allowancesSent = (): { readonly repairAttemptsRemaining: number } =>
  (
    h.decide.mock.calls[0]?.[0] as {
      readonly allowances: { readonly repairAttemptsRemaining: number };
    }
  ).allowances;

describe('decideCapabilityNeed', () => {
  beforeEach(() => {
    Object.values(h).forEach((mock) => mock.mockReset());
    h.decide.mockImplementation(async () => ({ decision: null }));
    h.agentById.mockImplementation(async () => null);
  });

  it('tells the orchestrator no repair attempt is left once the ledger holds two', async () => {
    h.countAttempts.mockImplementation(async () => 2);
    const { set, get } = createHarness();

    await decideCapabilityNeed({ set, get })({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });

    expect(h.countAttempts).toHaveBeenCalledWith(
      expect.objectContaining({ obligationId: OBLIGATION_ID }),
    );
    expect(allowancesSent().repairAttemptsRemaining).toBe(0);
  });

  it('tells the orchestrator what the ledger still allows after one attempt', async () => {
    h.countAttempts.mockImplementation(async () => 1);
    const { set, get } = createHarness();

    await decideCapabilityNeed({ set, get })({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });

    expect(allowancesSent().repairAttemptsRemaining).toBe(1);
  });

  it('tells the orchestrator nothing is left when the ledger cannot be read', async () => {
    h.countAttempts.mockImplementation(async () => {
      throw new Error('ledger unavailable');
    });
    const { set, get } = createHarness();

    await decideCapabilityNeed({ set, get })({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });

    expect(allowancesSent().repairAttemptsRemaining).toBe(0);
  });
});
