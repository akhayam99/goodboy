import type {
  Agent,
  AgentId,
  ImplementationCluster,
  PlanWithCount,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GetFn, SetFn } from './types';

const hoisted = vi.hoisted(() => {
  const insertArgs: Array<Record<string, unknown>> = [];
  return {
    insertArgs,
    invokeAgentInsert: vi.fn(async (args: Record<string, unknown>) => {
      insertArgs.push(args);
      return { id: `child-${insertArgs.length}` as AgentId, ...args } as unknown as Agent;
    }),
    invokeAgentList: vi.fn(async () => [] as Agent[]),
    invokeAgentUpdateStatus: vi.fn(async () => undefined),
  };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: hoisted.invokeAgentInsert,
  invokeAgentList: hoisted.invokeAgentList,
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
}));

import {
  advanceClusterImplementation,
  fanOutClusters,
  selectClustersPlan,
  selectFanOutPlan,
} from './clusterImplementation';

const plan = (over: Partial<Omit<PlanWithCount, 'id'>> & { id?: string }): PlanWithCount =>
  ({
    id: 'p1',
    sessionId: 's1',
    agentId: 'a',
    title: 'goal',
    bodyMd: '',
    status: 'active',
    consumptionCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clusters: [
      { title: 'c0', instructions: 'do 0' },
      { title: 'c1', instructions: 'do 1' },
    ],
    ...over,
  }) as PlanWithCount;

describe('selectClustersPlan', () => {
  it('returns null for an empty plan list', () => {
    expect(selectClustersPlan([])).toBeNull();
  });

  it('returns null when the only plan has fewer than 2 clusters', () => {
    expect(
      selectClustersPlan([plan({ clusters: [{ title: 'c0', instructions: 'x' }] })]),
    ).toBeNull();
  });

  it('returns null when the plan has no clusters field', () => {
    expect(selectClustersPlan([plan({ clusters: undefined })])).toBeNull();
  });

  it('matches an ad-hoc plan (no workflowRunId) when no target is given', () => {
    const p = plan({ id: 'ad-hoc' });
    expect(selectClustersPlan([p])?.id).toBe('ad-hoc');
  });

  it('does not match an ad-hoc plan against a workflowRunId target', () => {
    expect(selectClustersPlan([plan({})], 'wf1' as WorkflowRunId)).toBeNull();
  });

  it('matches a plan by workflowRunId', () => {
    const p = plan({ id: 'wf-plan', workflowRunId: 'wf1' as WorkflowRunId });
    expect(selectClustersPlan([p], 'wf1' as WorkflowRunId)?.id).toBe('wf-plan');
  });

  it('does not match a workflow plan when the target is undefined (ad-hoc lookup)', () => {
    const p = plan({ workflowRunId: 'wf1' as WorkflowRunId });
    expect(selectClustersPlan([p])).toBeNull();
  });

  it('returns the most recent matching plan (reverse iteration, last wins)', () => {
    const first = plan({ id: 'first' });
    const second = plan({ id: 'second' });
    expect(selectClustersPlan([first, second])?.id).toBe('second');
  });

  it('skips a trailing invalid plan and returns the earlier valid one', () => {
    const valid = plan({ id: 'valid' });
    const short = plan({ id: 'short', clusters: [{ title: 'only', instructions: 'x' }] });
    expect(selectClustersPlan([valid, short])?.id).toBe('valid');
  });

  it('isolates plans across workflow runs', () => {
    const wf1 = plan({ id: 'p-wf1', workflowRunId: 'wf1' as WorkflowRunId });
    const wf2 = plan({ id: 'p-wf2', workflowRunId: 'wf2' as WorkflowRunId });
    expect(selectClustersPlan([wf1, wf2], 'wf1' as WorkflowRunId)?.id).toBe('p-wf1');
    expect(selectClustersPlan([wf1, wf2], 'wf2' as WorkflowRunId)?.id).toBe('p-wf2');
  });
});

const fakeGet = (plans: ReadonlyArray<PlanWithCount>): GetFn =>
  (() => ({ sessionPlans: { s1: plans } })) as unknown as GetFn;

describe('selectFanOutPlan', () => {
  const sessionId = 's1' as SessionId;

  it('returns the explicit plan directly when it has 2+ clusters', () => {
    const explicit = plan({ id: 'explicit' });
    const result = selectFanOutPlan(fakeGet([plan({ id: 'store' })]), sessionId, {
      explicitPlan: explicit,
    });
    expect(result?.id).toBe('explicit');
  });

  it('falls back to the store lookup when the explicit plan has too few clusters', () => {
    const explicit = plan({ id: 'explicit', clusters: [{ title: 'c0', instructions: 'x' }] });
    const result = selectFanOutPlan(fakeGet([plan({ id: 'store' })]), sessionId, {
      explicitPlan: explicit,
    });
    expect(result?.id).toBe('store');
  });

  it('delegates to the store lookup by workflowRunId when no explicit plan is given', () => {
    const stored = plan({ id: 'wf-store', workflowRunId: 'wf1' as WorkflowRunId });
    const result = selectFanOutPlan(fakeGet([stored]), sessionId, {
      workflowRunId: 'wf1' as WorkflowRunId,
    });
    expect(result?.id).toBe('wf-store');
  });

  it('returns null when neither an explicit nor a stored plan qualifies', () => {
    expect(selectFanOutPlan(fakeGet([]), sessionId, {})).toBeNull();
  });
});

const SID = 's1' as SessionId;
const PARENT = 'parent' as AgentId;

const clusters: ReadonlyArray<ImplementationCluster> = [
  { title: 'c0', instructions: 'do 0' },
  { title: 'c1', instructions: 'do 1' },
];

const container = (over: Partial<Agent> = {}): Agent =>
  ({
    id: PARENT,
    sessionId: SID,
    ordinal: 0,
    name: 'container',
    status: 'pending',
    kind: 'implementer',
    ...over,
  }) as Agent;

const childAgent = (over: Omit<Partial<Agent>, 'id'> & { id: string; ordinal: number }): Agent =>
  ({
    sessionId: SID,
    parentAgentId: PARENT,
    name: over.name ?? `child-${over.ordinal}`,
    status: 'pending',
    kind: 'implementer',
    ...over,
    id: over.id as AgentId,
  }) as Agent;

function makeStore(initial: Record<string, unknown>) {
  const sendTurn = vi.fn(async () => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const refreshUnreadWorkspaces = vi.fn(async () => undefined);
  const maybeAutoAdvanceWorkflow = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: {},
    sessionPlans: {},
    transcripts: {},
    agentTurnState: {},
    agentKindOverride: {},
    selectedAgentId: PARENT,
    sendTurn,
    emitNotification,
    refreshUnreadWorkspaces,
    maybeAutoAdvanceWorkflow,
    ...initial,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return {
    state,
    get,
    set,
    sendTurn,
    emitNotification,
    refreshUnreadWorkspaces,
    maybeAutoAdvanceWorkflow,
  };
}

afterEach(() => {
  hoisted.insertArgs.length = 0;
  vi.clearAllMocks();
  hoisted.invokeAgentList.mockResolvedValue([]);
});

describe('fanOutClusters', () => {
  it('flips the container to running and inserts one implementer child per cluster', async () => {
    const c = container();
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(PARENT, { status: 'running' });
    expect(hoisted.insertArgs).toHaveLength(2);
    for (const args of hoisted.insertArgs) {
      expect(args.kind).toBe('implementer');
      expect(args.parentAgentId).toBe(PARENT);
      expect(args.sessionId).toBe(SID);
    }
  });

  it('assigns ordinals continuing past the highest existing run ordinal', async () => {
    const c = container({ ordinal: 4 });
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.insertArgs[0]?.ordinal).toBe(5);
    expect(hoisted.insertArgs[1]?.ordinal).toBe(6);
  });

  it('propagates the container workflowRunId to every child', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-1');
    }
  });

  it('omits workflowRunId for an ad-hoc container that has none', async () => {
    const c = container();
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBeUndefined();
    }
  });

  it('kicks off only the first child and seeds its turn state to idle', async () => {
    const c = container();
    const { get, set, sendTurn, state } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(sendTurn).toHaveBeenCalledTimes(1);
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { agentId: AgentId; content: string };
    expect(call.agentId).toBe('child-1');
    expect(call.content).toContain('1/2');
    const turnState = state.agentTurnState as Record<string, { kind: string }>;
    expect(turnState['child-1']?.kind).toBe('idle');
  });

  it('keeps the parent selected: starting the first child never reassigns selectedAgentId', async () => {
    const c = container();
    const { get, set, state } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      selectedAgentId: PARENT,
    });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(state.selectedAgentId).toBe(PARENT);
  });
});

describe('advanceClusterImplementation', () => {
  const done = (id: string) => `<<cluster-done id="${id}">>`;

  it('no-ops when the agent is not found in the session runs', async () => {
    const { get, set, sendTurn } = makeStore({ sessionPhaseRuns: { [SID]: [] } });
    await advanceClusterImplementation(set, get)(SID, 'ghost' as AgentId, done('ghost'));
    expect(sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });

  it('no-ops when the agent has no parent (not a cluster child)', async () => {
    const orphan = childAgent({ id: 'orphan', ordinal: 0, parentAgentId: undefined });
    const { get, set, sendTurn } = makeStore({ sessionPhaseRuns: { [SID]: [orphan] } });
    await advanceClusterImplementation(set, get)(SID, 'orphan' as AgentId, done('orphan'));
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('re-prompts the same child to continue when no done marker is present', async () => {
    const child = childAgent({ id: 'cont-a', ordinal: 0 });
    const p = plan({});
    const { get, set, sendTurn, state } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: { [SID]: [p] },
    });

    await advanceClusterImplementation(set, get)(SID, 'cont-a' as AgentId, 'still working...');

    expect(sendTurn).toHaveBeenCalledTimes(1);
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { agentId: AgentId; content: string };
    expect(call.agentId).toBe('cont-a');
    expect(call.content).toContain('stopped before finishing');
    expect(state.selectedAgentId).toBe(PARENT);
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });

  it('fails the child and notifies after exhausting continue attempts', async () => {
    const child = childAgent({ id: 'cont-b', ordinal: 0 });
    const p = plan({});
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: { [SID]: [p] },
    });
    const advance = advanceClusterImplementation(store.set, store.get);

    await advance(SID, 'cont-b' as AgentId, 'no marker 1');
    await advance(SID, 'cont-b' as AgentId, 'no marker 2');
    expect(store.sendTurn).toHaveBeenCalledTimes(2);
    expect(store.emitNotification).not.toHaveBeenCalled();

    await advance(SID, 'cont-b' as AgentId, 'no marker 3');
    expect(store.sendTurn).toHaveBeenCalledTimes(2);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith('cont-b', {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(store.emitNotification).toHaveBeenCalled();
    expect(store.refreshUnreadWorkspaces).toHaveBeenCalled();
  });

  it('marks the child completed and starts the next child on a done marker', async () => {
    const c0 = childAgent({ id: 'k0', ordinal: 0 });
    const c1 = childAgent({ id: 'k1', ordinal: 1 });
    const p = plan({});
    const { get, set, sendTurn, state, refreshUnreadWorkspaces } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [p] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'k0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(set, get)(SID, 'k0' as AgentId, done('k0'));

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'k0',
      expect.objectContaining({ status: 'completed' }),
    );
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { agentId: AgentId; content: string };
    expect(call.agentId).toBe('k1');
    expect(call.content).toContain('2/2');
    expect(state.selectedAgentId).toBe(PARENT);
    expect(refreshUnreadWorkspaces).toHaveBeenCalled();
  });

  it('completes the container and auto-advances when the last child finishes', async () => {
    const c0 = childAgent({ id: 'm0', ordinal: 0, status: 'completed' });
    const c1 = childAgent({ id: 'm1', ordinal: 1 });
    const p = plan({});
    const { get, set, sendTurn, refreshUnreadWorkspaces, maybeAutoAdvanceWorkflow } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [p] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      c0,
      childAgent({ id: 'm1', ordinal: 1, status: 'completed' }),
    ]);

    await advanceClusterImplementation(set, get)(SID, 'm1' as AgentId, done('m1'));

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      PARENT,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
    expect(refreshUnreadWorkspaces).toHaveBeenCalledTimes(1);
    expect(maybeAutoAdvanceWorkflow).toHaveBeenCalledWith(SID);
  });
});
