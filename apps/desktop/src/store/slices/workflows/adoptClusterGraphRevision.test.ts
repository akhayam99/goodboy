import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ClusterCompletionHold,
  ClusterExecutionGraph,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  adopt: vi.fn(),
  refuseRevision: vi.fn(),
  agentList: vi.fn(),
  reserve: vi.fn(),
  bind: vi.fn(),
  routing: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.agentList,
  invokeClusterGraphRevisionAdopt: h.adopt,
  invokeClusterGraphRevisionRefuse: h.refuseRevision,
}));
vi.mock('../agents/reserveGeneration', () => ({
  reserveGeneration: h.reserve,
  bindGeneration: h.bind,
}));
vi.mock('./childRoutingBatch', () => ({ childRoutingBatch: h.routing }));

import { adoptClusterGraphRevision } from './adoptClusterGraphRevision';

const SESSION_ID = 'session-1' as SessionId;
const CONTAINER_ID = 'container-1' as AgentId;

const graphOf = (overrides: Partial<ClusterExecutionGraph> = {}): ClusterExecutionGraph => ({
  containerAgentId: CONTAINER_ID,
  sessionId: SESSION_ID,
  workflowRunId: null,
  planId: 'plan-1',
  goalTitle: 'rewrite the routing',
  graph: {
    executionVersion: 2,
    nodes: [
      {
        id: 'discovery',
        ordinal: 0,
        title: 'Discovery',
        instructions: 'map the routing',
        role: 'scout',
        dependsOn: [],
        expectedOutput: null,
      },
      {
        id: 'impl',
        ordinal: 1,
        title: 'Rewrite',
        instructions: 'rewrite it',
        role: 'implementer',
        dependsOn: ['discovery'],
        expectedOutput: null,
      },
    ],
  },
  nodes: [
    {
      nodeId: 'discovery',
      agentId: 'a-discovery' as AgentId,
      ordinal: 0,
      role: 'scout',
      state: 'active',
      supersededBy: null,
      revision: 1,
      resultState: 'pending',
    },
    {
      nodeId: 'impl',
      agentId: 'a-impl' as AgentId,
      ordinal: 1,
      role: 'implementer',
      state: 'active',
      supersededBy: null,
      revision: 1,
      resultState: 'pending',
    },
  ],
  revision: 1,
  frozenReason: 'a structural defect',
  frozenObligationId: 'obligation-1',
  ...overrides,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
});

const agentOf = ({
  id,
  status,
}: {
  readonly id: string;
  readonly status: Agent['status'];
}): Agent =>
  ({
    id: id as AgentId,
    sessionId: SESSION_ID,
    parentAgentId: CONTAINER_ID,
    ordinal: 1,
    name: id,
    status,
    kind: 'implementer',
  }) as Agent;

const proposal = ({ baseRevision }: { readonly baseRevision: number }): string =>
  [
    '<<plan-revision>>',
    JSON.stringify({
      baseRevision,
      nodes: [
        { disposition: 'retain', id: 'discovery' },
        {
          disposition: 'replace',
          id: 'impl',
          node: {
            id: 'impl-split',
            title: 'Rewrite in two passes',
            instructions: 'split the rewrite',
            role: 'implementer',
            dependsOn: ['discovery'],
          },
        },
      ],
    }),
    '<</plan-revision>>',
  ].join('\n');

const makeStore = ({
  graph,
  agents,
  holds = [],
}: {
  readonly graph: ClusterExecutionGraph | null;
  readonly agents: ReadonlyArray<Agent>;
  readonly holds?: ReadonlyArray<ClusterCompletionHold>;
}) => {
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    clusterExecutionGraphs: { [SESSION_ID]: graph === null ? [] : [graph] },
    clusterCompletionHolds: { [SESSION_ID]: holds },
    agentKindOverride: {},
    emitNotification: vi.fn(async () => undefined),
    refreshUnreadWorkspaces: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    const patch =
      typeof update === 'function'
        ? (update as (current: Record<string, unknown>) => Record<string, unknown>)(state)
        : (update as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

describe('adoptClusterGraphRevision', () => {
  beforeEach(() => {
    Object.values(h).forEach((mock) => mock.mockReset());
    h.agentList.mockImplementation(async () => []);
    h.reserve.mockImplementation(async ({ count }: { readonly count: number }) => ({
      kind: 'granted' as const,
      reservations: Array.from({ length: count }, (_, index) => ({
        reservationId: `reservation-${index}`,
      })),
    }));
    h.bind.mockImplementation(async () => undefined);
    h.routing.mockImplementation(({ requests }: { readonly requests: ReadonlyArray<unknown> }) => ({
      kind: 'ready' as const,
      entries: requests.map(() => ({
        routingLock: null,
        routingDecision: null,
        taskProfile: null,
        providerOverride: null,
        modelOverride: null,
        effort: null,
      })),
    }));
    h.refuseRevision.mockImplementation(async () => graphOf());
    h.adopt.mockImplementation(async () => ({
      adopted: true,
      graph: graphOf({ revision: 2, frozenReason: null, frozenObligationId: null }),
      agents: [],
    }));
  });

  it('adopts the revision as one write: supersedes, appends and unfreezes', async () => {
    const { set, get, state } = makeStore({
      graph: graphOf(),
      agents: [
        agentOf({ id: 'a-discovery', status: 'completed' }),
        agentOf({ id: 'a-impl', status: 'pending' }),
      ],
    });

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome).toEqual({
      kind: 'adopted',
      revision: 2,
      superseded: ['impl'],
      quarantined: [],
      appended: ['impl-split'],
    });
    const call = h.adopt.mock.calls[0]![0] as {
      fromRevision: number;
      toRevision: number;
      nodes: ReadonlyArray<Record<string, unknown>>;
      agents: ReadonlyArray<Record<string, unknown>>;
    };
    expect(call.fromRevision).toBe(1);
    expect(call.toRevision).toBe(2);
    expect(call.agents).toHaveLength(1);
    expect(call.agents[0]?.name).toBe('Rewrite in two passes');
    const retired = call.nodes.find((node) => node.nodeId === 'impl');
    expect(retired).toMatchObject({ state: 'superseded', supersededBy: 'impl-split' });
    expect(retired?.agentId).toBe('a-impl');
    const kept = call.nodes.find((node) => node.nodeId === 'discovery');
    expect(kept).toMatchObject({ state: 'active', resultState: 'retained' });
    const stored = (
      state.clusterExecutionGraphs as Record<string, ReadonlyArray<ClusterExecutionGraph>>
    )[SESSION_ID];
    expect(stored?.[0]?.revision).toBe(2);
    expect(stored?.[0]?.frozenReason).toBeNull();
  });

  it('quarantines the result of an attempt that is still running', async () => {
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [
        agentOf({ id: 'a-discovery', status: 'completed' }),
        agentOf({ id: 'a-impl', status: 'running' }),
      ],
    });

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome.kind === 'adopted' ? outcome.quarantined : []).toEqual(['impl']);
    const call = h.adopt.mock.calls[0]![0] as { nodes: ReadonlyArray<Record<string, unknown>> };
    expect(call.nodes.find((node) => node.nodeId === 'impl')?.resultState).toBe('quarantined');
  });

  it('refuses a stale proposal and leaves the graph frozen', async () => {
    const { set, get } = makeStore({
      graph: graphOf({ revision: 2 }),
      agents: [agentOf({ id: 'a-impl', status: 'pending' })],
    });
    h.refuseRevision.mockImplementation(async () => graphOf({ revision: 2 }));

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('revision 2');
    expect(h.adopt).not.toHaveBeenCalled();
    expect(h.refuseRevision).toHaveBeenCalledWith(
      expect.objectContaining({ containerAgentId: CONTAINER_ID, fromRevision: 2 }),
    );
  });

  it('treats a released node as completed, so a revision cannot replace it', async () => {
    const releasedHold: ClusterCompletionHold = {
      id: 'hold-impl',
      sessionId: SESSION_ID,
      workflowRunId: null,
      containerAgentId: CONTAINER_ID,
      sourceAgentId: 'a-impl' as AgentId,
      sourceTurnId: 'turn-impl',
      reason: 'missing-outcome',
      findings: [],
      state: 'resolved',
      resolutionEvidence: 'checked by hand',
      resolvedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    };
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [agentOf({ id: 'a-discovery', status: 'completed' })],
      holds: [releasedHold],
    });

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('"impl" already completed');
    expect(h.adopt).not.toHaveBeenCalled();
  });

  it('refuses a planner turn that carries no revision', async () => {
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [agentOf({ id: 'a-impl', status: 'pending' })],
    });

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: 'here is what I would do, roughly.',
      reason: 'no marker',
    });

    expect(outcome).toEqual({
      kind: 'refused',
      reason: 'the planner emitted no plan revision',
    });
    expect(h.adopt).not.toHaveBeenCalled();
  });

  it('records every refusal under its own id, apart from the adopted revision', async () => {
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [agentOf({ id: 'a-impl', status: 'pending' })],
    });
    const attempt = () =>
      adoptClusterGraphRevision({
        set,
        get,
        sessionId: SESSION_ID,
        containerAgentId: CONTAINER_ID,
        obligationId: 'obligation-1',
        proposalText: 'no marker here',
        reason: 'no marker',
      });

    await attempt();
    await attempt();

    const ids = h.refuseRevision.mock.calls.map((call) => (call[0] as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain(`cluster-graph-revision:${CONTAINER_ID}:r1`);
  });

  it('leaves the graph frozen when the generation allowance is exhausted', async () => {
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [agentOf({ id: 'a-impl', status: 'pending' })],
    });
    h.reserve.mockImplementation(async () => ({
      kind: 'refused' as const,
      reason: 'this run already generated 32 agents',
      isFirstRefusal: true,
    }));

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome).toEqual({
      kind: 'refused',
      reason: 'this run already generated 32 agents',
    });
    expect(h.adopt).not.toHaveBeenCalled();
  });

  it('refuses when another writer moved the revision first', async () => {
    const { set, get } = makeStore({
      graph: graphOf(),
      agents: [agentOf({ id: 'a-impl', status: 'pending' })],
    });
    h.adopt.mockImplementation(async () => ({
      adopted: false,
      graph: graphOf({ revision: 3 }),
      agents: [],
    }));

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'the planner split the rewrite',
    });

    expect(outcome.kind).toBe('refused');
    expect(h.bind).not.toHaveBeenCalled();
  });

  it('reports an execution that consumed no graph instead of inventing one', async () => {
    const { set, get } = makeStore({ graph: null, agents: [] });

    const outcome = await adoptClusterGraphRevision({
      set,
      get,
      sessionId: SESSION_ID,
      containerAgentId: CONTAINER_ID,
      obligationId: 'obligation-1',
      proposalText: proposal({ baseRevision: 1 }),
      reason: 'nothing to revise',
    });

    expect(outcome.kind).toBe('unavailable');
    expect(h.refuseRevision).not.toHaveBeenCalled();
  });
});
