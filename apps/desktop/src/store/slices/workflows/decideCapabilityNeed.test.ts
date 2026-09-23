import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  CapabilityObligation,
  ClusterExecutionGraph,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  decide: vi.fn(),
  clientOptions: [] as Array<Record<string, unknown>>,
  recordUsage: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    OrchestratorClient: class {
      constructor(options: Record<string, unknown>) {
        h.clientOptions.push(options);
      }
      decide = h.decide;
    },
  };
});
vi.mock('./recordOrchestratorUsage', () => ({ recordOrchestratorUsage: h.recordUsage }));
vi.mock('./applyNeedDisposition', () => ({ applyNeedDisposition: h.apply }));
vi.mock('../worktrees/getSessionRepo', () => ({ getSessionRepo: () => null }));
vi.mock('../turn/agentEvidenceInventory', () => ({
  issuedAgentInventory: () => ({ inventory: { revision: 'inv-1', entries: [] } }),
}));
vi.mock('./buildNeedPacket', () => ({
  buildNeedRequest: () => ({ evidenceRefs: [] }),
  buildEvidenceExcerpts: () => [],
  buildUnresolvedObligations: () => [],
}));

import { decideCapabilityNeed } from './decideCapabilityNeed';

const SESSION_ID = 'session-1' as SessionId;
const REQUESTER_ID = 'agent-1' as AgentId;
const CONTAINER_ID = 'container-1' as AgentId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;
const OBLIGATION_ID = 'capability-obligation:agent-1:implementer:repair';

const requester: Agent = {
  id: REQUESTER_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'review the change',
  kind: 'reviewer',
  status: 'running',
  workflowRunId: RUN_ID,
  parentAgentId: CONTAINER_ID,
};

const obligation: CapabilityObligation = {
  id: OBLIGATION_ID,
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
  requests: [],
  holdIds: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

const graph = {
  containerAgentId: CONTAINER_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  planId: 'plan-1',
  goalTitle: 'restore the guard',
  graph: { executionVersion: 2, nodes: [] },
  nodes: [],
  revision: 4,
  frozenReason: null,
  frozenObligationId: null,
} as unknown as ClusterExecutionGraph;

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
    capabilityGrants: { [SESSION_ID]: [] },
    clusterExecutionGraphs: { [SESSION_ID]: [graph] },
    providers: [],
    providerCooldowns: {},
    budgetAlerts: [],
    workspaceOverrides: {},
    authResults: {},
    agentKindOverride: {},
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

describe('decideCapabilityNeed', () => {
  beforeEach(() => {
    h.decide.mockReset();
    h.recordUsage.mockReset();
    h.apply.mockReset();
    h.clientOptions.length = 0;
    h.decide.mockImplementation(async () => ({ decision: null }));
  });

  it('runs the decision through invocation admission and records its usage', async () => {
    const { set, get } = createHarness();

    await decideCapabilityNeed({ set, get })({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });

    const options = h.clientOptions[0] as {
      readonly invocation?: Record<string, unknown>;
      readonly onUsage?: (usage: Record<string, unknown>) => unknown;
    };
    expect(options.invocation).toMatchObject({
      purpose: 'orchestrator',
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      agentId: REQUESTER_ID,
    });
    options.onUsage?.({ inputTokens: 10, outputTokens: 5 });
    expect(h.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: REQUESTER_ID,
        workflowRunId: RUN_ID,
      }),
    );
  });

  it('tells the orchestrator the persisted graph revision, not the plan version', async () => {
    const { set, get } = createHarness();

    await decideCapabilityNeed({ set, get })({
      sessionId: SESSION_ID,
      obligationId: OBLIGATION_ID,
    });

    const packet = h.decide.mock.calls[0]?.[0] as { readonly graphRevision?: string };
    expect(packet.graphRevision).toBe(`${CONTAINER_ID}@r4`);
  });
});
