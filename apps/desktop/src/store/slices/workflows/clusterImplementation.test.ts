import type {
  Agent,
  AgentId,
  ImplementationCluster,
  ModelEffort,
  PlanConsumption,
  PlanWithCount,
  ProviderId,
  SessionId,
  StepId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLE_DEFAULTS, resolveModelArgs, resolveStoredModelSelection } from '@goodboy/core';
import {
  isWorkflowRoutingDecision,
  isWorkflowTaskProfile,
  parseRoutingJson,
  stringifyRoutingJson,
} from '@goodboy/db';
import type { GetFn, SetFn } from './types';

const hoisted = vi.hoisted(() => {
  const insertArgs: Array<Record<string, unknown>> = [];
  return {
    insertArgs,
    invokeAgentInsertBatch: vi.fn(
      async ({
        children,
      }: {
        parentAgentId: string;
        children: ReadonlyArray<Record<string, unknown>>;
      }) => {
        const agents = children.map((args, index) => {
          insertArgs.push(args);
          return { id: `child-${index + 1}` as AgentId, ...args } as unknown as Agent;
        });
        return { inserted: true, agents };
      },
    ),
    invokeAgentList: vi.fn(async () => [] as Agent[]),
    invokeAgentUpdateStatus: vi.fn(async () => undefined),
    invokeWorkflowNodeRoutingUpdate: vi.fn(async () => undefined),
    invokeListConsumptionsForPlan: vi.fn(async () => [] as ReadonlyArray<PlanConsumption>),
    summarizeAgentOutput: vi.fn(async () => ({ summary: 'model summary', degraded: false })),
  };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsertBatch: hoisted.invokeAgentInsertBatch,
  invokeAgentList: hoisted.invokeAgentList,
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
  invokeWorkflowNodeRoutingUpdate: hoisted.invokeWorkflowNodeRoutingUpdate,
}));

vi.mock('../../../features/plans/plans', () => ({
  listConsumptionsForPlan: hoisted.invokeListConsumptionsForPlan,
}));

vi.mock('../../summarizeAgentOutput', () => ({
  summarizeAgentOutput: hoisted.summarizeAgentOutput,
}));

import {
  advanceClusterImplementation,
  composeClusterBoundary,
  fanOutClusters,
  resumeClusterChildren,
  selectClustersPlan,
  selectFanOutPlan,
  unsettledClusterChildren,
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

  it('still returns a consumed plan so the dashboard keeps rendering it (display contract)', () => {
    const consumed = plan({
      id: 'planning',
      status: 'consumed',
      workflowRunId: 'wf1' as WorkflowRunId,
    });
    expect(selectClustersPlan([consumed], 'wf1' as WorkflowRunId)?.id).toBe('planning');
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

  it('ignores a consumed plan so a later workflow step does not re-fan-out the same clusters', () => {
    const consumed = plan({
      id: 'planning',
      status: 'consumed',
      workflowRunId: 'wf1' as WorkflowRunId,
    });
    expect(
      selectFanOutPlan(fakeGet([consumed]), sessionId, { workflowRunId: 'wf1' as WorkflowRunId }),
    ).toBeNull();
  });
});

describe('composeClusterBoundary', () => {
  it('states the single-cluster boundary and embeds the child-scoped done marker', () => {
    const text = composeClusterBoundary('child-7' as AgentId);
    expect(text).toContain('**Scope** this cluster only');
    expect(text).toContain('<<cluster-done id="child-7">>');
    expect(text.split('\n')).toHaveLength(1);
  });
});

const SID = 's1' as SessionId;
const PARENT = 'parent' as AgentId;

const clusters: ReadonlyArray<ImplementationCluster> = [
  { title: 'c0', instructions: 'do 0' },
  { title: 'c1', instructions: 'do 1' },
];

const CONNECTED_PROVIDERS = [
  { id: 'anthropic', connection: 'connected' },
  { id: 'codex', connection: 'connected' },
];

const mixedClusters: ReadonlyArray<ImplementationCluster> = [
  {
    title: 'light rename',
    instructions: 'rename the symbol',
    routingProposal: {
      pick: { provider: 'anthropic', model: 'haiku-4.5', effort: 'low' },
      reason: 'A mechanical rename does not need a frontier model.',
      source: 'agent',
      profile: { taskType: 'implementation', difficulty: 'light', basis: 'agent' },
    },
  },
  {
    title: 'heavy rewrite',
    instructions: 'rewrite the resolver',
    routingProposal: {
      pick: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
      reason: 'A resolver rewrite touches the precedence contract.',
      source: 'agent',
      profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
    },
  },
];

const storedClusters: ReadonlyArray<ImplementationCluster> = [
  {
    title: 'light rename',
    instructions: 'rename the symbol',
    routingProposal: {
      pick: { provider: 'anthropic', model: 'sonnet-5', effort: 'low' },
      reason: 'A mechanical rename does not need a frontier model.',
      source: 'agent',
      profile: { taskType: 'implementation', difficulty: 'light', basis: 'agent' },
    },
  },
  {
    title: 'heavy rewrite',
    instructions: 'rewrite the resolver',
    routingProposal: {
      pick: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
      reason: 'A resolver rewrite touches the precedence contract.',
      source: 'agent',
      profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
    },
  },
];

type ExecutionRecord = Readonly<{
  agentId: AgentId;
  provider: ProviderId | null;
  model: string | null;
  effort: ModelEffort | null;
  args: ReadonlyArray<string>;
}>;

type CaptureParams = {
  readonly state: Record<string, unknown>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
};

const captureExecutions = ({ state, sendTurn }: CaptureParams): ReadonlyArray<ExecutionRecord> => {
  const records: Array<ExecutionRecord> = [];
  sendTurn.mockImplementation(async ({ agentId }: { readonly agentId: AgentId }) => {
    const runs = (state.sessionPhaseRuns as Record<string, ReadonlyArray<Agent>>)[SID] ?? [];
    const agent = runs.find((candidate) => candidate.id === agentId) ?? null;
    const provider = (agent?.providerOverride ?? null) as ProviderId | null;
    const model = agent?.modelOverride ?? null;
    const effort = (agent?.effort ?? null) as ModelEffort | null;
    if (provider === null || model === null) {
      records.push({ agentId, provider, model, effort, args: [] });
      return undefined;
    }
    const stored = resolveStoredModelSelection({
      provider,
      id: model,
      ...(effort !== null && { effort }),
    });
    records.push({
      agentId,
      provider,
      model,
      effort,
      args: resolveModelArgs({ provider, selection: stored.selection }).args,
    });
    return undefined;
  });
  return records;
};

const legacyClusters: ReadonlyArray<ImplementationCluster> = [
  { title: 'rename the symbol', instructions: 'rename the helper in one file' },
  {
    title: 'rewrite the resolver',
    instructions: [
      'Redesign the routing resolver so precedence is one pass, then migrate database rows,',
      'then rewrite the callers across packages/core and apps/desktop.',
      '1. map the callers',
      '2. rewrite the resolver',
      '3. migrate the rows',
    ].join('\n'),
  },
];

type RoutingUpdate = Readonly<{
  id: string;
  routingLock: WorkflowRoutingLock | null;
  routingDecision: WorkflowRoutingDecision;
  taskProfile: WorkflowTaskProfile | null;
  providerOverride: ProviderId;
  modelOverride: string;
  effort: ModelEffort | null;
}>;

const routingUpdates = (): ReadonlyArray<RoutingUpdate> =>
  hoisted.invokeWorkflowNodeRoutingUpdate.mock.calls.map(
    (call) => (call as ReadonlyArray<unknown>)[0] as RoutingUpdate,
  );

const backendRows =
  ({ base }: { readonly base: ReadonlyArray<Agent> }) =>
  async (): Promise<Array<Agent>> =>
    base.map((agent) => {
      const update = [...routingUpdates()].reverse().find((candidate) => candidate.id === agent.id);
      if (update === undefined) {
        return agent;
      }
      return {
        ...agent,
        routingLock: update.routingLock ?? undefined,
        routingDecision: update.routingDecision,
        taskProfile: update.taskProfile ?? undefined,
        providerOverride: update.providerOverride,
        modelOverride: update.modelOverride,
        ...(update.effort !== null && { effort: update.effort }),
      } as Agent;
    });

const reloadedChild = ({
  id,
  ordinal,
  args,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly args: Record<string, unknown>;
}): Agent => {
  const decision = parseRoutingJson({
    value: stringifyRoutingJson({
      value: (args.routingDecision ?? null) as WorkflowRoutingDecision | null,
      isValid: isWorkflowRoutingDecision,
      field: 'routing decision',
    }),
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  });
  const profile = parseRoutingJson({
    value: stringifyRoutingJson({
      value: (args.taskProfile ?? null) as WorkflowTaskProfile | null,
      isValid: isWorkflowTaskProfile,
      field: 'task profile',
    }),
    isValid: isWorkflowTaskProfile,
    field: 'task profile',
  });
  return childAgent({
    id,
    ordinal,
    status: 'pending',
    name: args.name as string,
    ...(args.providerOverride !== undefined && {
      providerOverride: args.providerOverride as ProviderId,
    }),
    ...(args.modelOverride !== undefined && { modelOverride: args.modelOverride as string }),
    ...(args.effort !== undefined && { effort: args.effort as ModelEffort }),
    ...(decision !== null && { routingDecision: decision }),
    ...(profile !== null && { taskProfile: profile }),
  });
};

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

const sessionRow = (autoRun: boolean) =>
  ({
    id: SID,
    workspaceId: 'w1',
    autoRun,
    workflowRuns: [{ id: 'wf-1', workflowId: 'flow-1' }],
    providerPreference: { defaultProvider: 'anthropic' },
  }) as unknown as Record<string, unknown>;

function makeStore(initial: Record<string, unknown>) {
  const sendTurn = vi.fn(async () => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const refreshUnreadWorkspaces = vi.fn(async () => undefined);
  const maybeAutoAdvanceWorkflow = vi.fn(async () => undefined);
  const loadSessionPlans = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: {},
    sessionPlans: {},
    planConsumptions: {},
    sessions: [sessionRow(true)],
    sessionProjectMounts: {},
    sessionActiveProject: {},
    sessionWorktrees: {},
    sessionBranches: {},
    workspaces: [],
    transcripts: {},
    agentTurnState: {},
    agentKindOverride: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    phaseTemplates: {},
    workspaceOverrides: {},
    providers: [],
    providerCooldowns: {},
    selectedAgentId: PARENT,
    sendTurn,
    emitNotification,
    refreshUnreadWorkspaces,
    maybeAutoAdvanceWorkflow,
    loadSessionPlans,
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
    loadSessionPlans,
  };
}

afterEach(() => {
  hoisted.insertArgs.length = 0;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  hoisted.invokeAgentList.mockResolvedValue([]);
  hoisted.invokeListConsumptionsForPlan.mockResolvedValue([]);
  hoisted.summarizeAgentOutput.mockResolvedValue({ summary: 'model summary', degraded: false });
});

describe('fanOutClusters', () => {
  it('flips the container to running and inserts one implementer child per cluster', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(PARENT, { status: 'running' });
    expect(hoisted.insertArgs).toHaveLength(2);
    for (const args of hoisted.insertArgs) {
      expect(args.kind).toBe('implementer');
      expect(args.parentAgentId).toBe(PARENT);
      expect(args.sessionId).toBe(SID);
      expect(args.stepId).toBeUndefined();
    }
  });

  it('materializes every cluster child through one parent-scoped batch', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.invokeAgentInsertBatch).toHaveBeenCalledTimes(1);
    const call = hoisted.invokeAgentInsertBatch.mock.calls[0]![0];
    expect(call.parentAgentId).toBe(PARENT);
    expect(call.children).toHaveLength(2);
  });

  it('leaves no children and starts nothing when the batch fails', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set, sendTurn, state } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });
    hoisted.invokeAgentInsertBatch.mockRejectedValueOnce(new Error('database is locked'));

    await expect(fanOutClusters(set, get, SID, c, clusters, 'goal')).rejects.toThrow(
      'database is locked',
    );

    expect(hoisted.insertArgs).toHaveLength(0);
    expect(hoisted.invokeAgentList).not.toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
    expect(Object.keys(state.transcripts as Record<string, unknown>)).toEqual([]);
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });

  it('does not start a second batch for a parent the backend already materialized', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set, sendTurn } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });
    hoisted.invokeAgentInsertBatch.mockResolvedValueOnce({ inserted: false, agents: [] });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentList).not.toHaveBeenCalled();
  });

  it('assigns ordinals continuing past the highest existing run ordinal', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container({ ordinal: 4 });
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.insertArgs[0]?.ordinal).toBe(5);
    expect(hoisted.insertArgs[1]?.ordinal).toBe(6);
  });

  it('propagates the container workflowRunId to every child', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-1');
    }
  });

  it('omits workflowRunId for an ad-hoc container that has none', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set } = makeStore({ sessionPhaseRuns: { [SID]: [c] } });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBeUndefined();
    }
  });

  it('a container pin does not cascade onto its cluster children', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container({
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
      routingLock: {
        version: 1,
        pick: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
        origin: 'user',
      },
    });
    const { get, set } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(2);
    for (const args of hoisted.insertArgs) {
      expect(args.modelOverride).toBe(ROLE_DEFAULTS.implementer.model);
      expect(args.routingLock).toBeUndefined();
    }
  });

  it('falls back to the implementer role routing when the container pins nothing', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container();
    const { get, set } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(set, get, SID, c, clusters, 'goal');

    expect(hoisted.insertArgs[0]?.modelOverride).toBe(ROLE_DEFAULTS.implementer.model);
    expect(hoisted.insertArgs[0]?.effort).toBe(ROLE_DEFAULTS.implementer.effort);
  });

  it('mixed-complexity clusters persist distinct choices and execute sequentially', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const c = container();
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(set, get, SID, c, mixedClusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(2);
    expect(hoisted.insertArgs[0]?.modelOverride).toBe('haiku-4.5');
    expect(hoisted.insertArgs[1]?.modelOverride).toBe('opus-5');
    expect(hoisted.insertArgs[0]?.modelOverride).not.toBe(hoisted.insertArgs[1]?.modelOverride);
    const firstDecision = hoisted.insertArgs[0]?.routingDecision as {
      readonly selected: { readonly model: string };
      readonly source: string;
    };
    expect(firstDecision.source).toBe('agent');
    expect(firstDecision.selected.model).toBe('haiku-4.5');
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { readonly agentId: AgentId };
    expect(call.agentId).toBe('child-1');
  });

  it('resume uses stored child routing rather than parent routing', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const c = container({
      status: 'running',
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
    });
    const child = childAgent({
      id: 'child-1',
      ordinal: 1,
      status: 'pending',
      providerOverride: 'anthropic',
      modelOverride: 'sonnet-5',
      effort: 'low',
      routingDecision: {
        version: 1,
        proposal: storedClusters[0]!.routingProposal ?? null,
        selected: { provider: 'anthropic', model: 'sonnet-5', effort: 'low' },
        source: 'agent',
        reason: 'A mechanical rename does not need a frontier model.',
        adjustment: 'none',
        executed: null,
      },
    });
    const { get, set, state, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c, child] },
      sessionPlans: { [SID]: [plan({ clusters: storedClusters, status: 'active' })] },
      providers: CONNECTED_PROVIDERS,
    });
    hoisted.invokeAgentList.mockResolvedValue([c, child]);
    const executions = captureExecutions({ state, sendTurn });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: c });

    expect(resumed).toBe(true);
    expect(executions).toEqual([
      {
        agentId: 'child-1',
        provider: 'anthropic',
        model: 'sonnet-5',
        effort: 'low',
        args: ['--model', 'claude-sonnet-5', '--effort', 'low'],
      },
    ]);
    expect(hoisted.invokeWorkflowNodeRoutingUpdate).not.toHaveBeenCalled();
  });

  it('kicks off only the first child and seeds its turn state to idle', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
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

describe('cluster child routing lifecycle', () => {
  it('legacy children use their own profile', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const c = container({
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
      routingLock: {
        version: 1,
        pick: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
        origin: 'user',
      },
    });
    const { get, set } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(set, get, SID, c, legacyClusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(2);
    const light = hoisted.insertArgs[0]!;
    const heavy = hoisted.insertArgs[1]!;
    expect(light.taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'light',
      basis: 'heuristic',
    });
    expect(heavy.taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'heavy',
      basis: 'heuristic',
    });
    for (const args of [light, heavy]) {
      const decision = args.routingDecision as WorkflowRoutingDecision;
      expect(decision.source).toBe('heuristic');
      expect(decision.proposal).toBeNull();
      expect(args.routingLock).toBeUndefined();
    }
  });

  it('flag-off children keep the configured default for the same two texts', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    const c = container({
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
    });
    const { get, set } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(set, get, SID, c, legacyClusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(2);
    for (const args of hoisted.insertArgs) {
      expect(args.modelOverride).toBe(ROLE_DEFAULTS.implementer.model);
      expect(args.effort).toBe(ROLE_DEFAULTS.implementer.effort);
      expect((args.routingDecision as WorkflowRoutingDecision).source).toBe('kind_default');
      expect(args.routingLock).toBeUndefined();
    }
    expect(hoisted.insertArgs[0]?.taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'light',
      basis: 'heuristic',
    });
    expect(hoisted.insertArgs[1]?.taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'heavy',
      basis: 'heuristic',
    });
    expect(hoisted.insertArgs[0]?.modelOverride).toBe(hoisted.insertArgs[1]?.modelOverride);
  });

  it('routing survives database reopen and reaches execution', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const c = container();
    const first = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
    });

    await fanOutClusters(first.set, first.get, SID, c, storedClusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(2);
    expect(hoisted.insertArgs[0]?.modelOverride).toBe('sonnet-5');
    expect(hoisted.insertArgs[1]?.modelOverride).toBe('opus-5');

    const reopened = [
      reloadedChild({ id: 'child-1', ordinal: 1, args: hoisted.insertArgs[0]! }),
      reloadedChild({ id: 'child-2', ordinal: 2, args: hoisted.insertArgs[1]! }),
    ];
    expect(reopened[0]?.routingDecision?.selected).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'low',
    });
    expect(reopened[1]?.routingDecision?.selected).toEqual({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
    });

    hoisted.invokeWorkflowNodeRoutingUpdate.mockClear();
    const running = container({ status: 'running' });
    const second = makeStore({
      sessionPhaseRuns: { [SID]: [running, ...reopened] },
      sessionPlans: { [SID]: [plan({ clusters: storedClusters, status: 'active' })] },
      providers: CONNECTED_PROVIDERS,
    });
    hoisted.invokeAgentList.mockImplementation(backendRows({ base: [running, ...reopened] }));
    const executions = captureExecutions({ state: second.state, sendTurn: second.sendTurn });

    const resumed = await resumeClusterChildren({
      set: second.set,
      get: second.get,
      sessionId: SID,
      container: running,
    });

    expect(resumed).toBe(true);
    expect(executions).toEqual([
      {
        agentId: 'child-1',
        provider: 'anthropic',
        model: 'sonnet-5',
        effort: 'low',
        args: ['--model', 'claude-sonnet-5', '--effort', 'low'],
      },
    ]);
    expect(routingUpdates()).toHaveLength(0);
  });

  it('availability changes before activation: an automatic child recovers', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const running = container({ status: 'running' });
    const child = childAgent({
      id: 'child-1',
      ordinal: 1,
      status: 'pending',
      name: 'heavy rewrite',
      providerOverride: 'codex',
      modelOverride: 'gpt-5.6-sol',
      effort: 'high',
      routingDecision: {
        version: 1,
        proposal: {
          pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
          reason: 'A resolver rewrite touches the precedence contract.',
          source: 'agent',
          profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
        },
        selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        source: 'agent',
        reason: 'A resolver rewrite touches the precedence contract.',
        adjustment: 'none',
        executed: null,
      },
    });
    const { state, set, get, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [running, child] },
      sessionPlans: { [SID]: [plan({ clusters: storedClusters, status: 'active' })] },
      providers: [{ id: 'anthropic', connection: 'connected' }],
    });
    hoisted.invokeAgentList.mockImplementation(backendRows({ base: [running, child] }));
    const executions = captureExecutions({ state, sendTurn });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: running });

    expect(resumed).toBe(true);
    const updates = routingUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe('child-1');
    expect(updates[0]?.routingDecision.source).toBe('heuristic');
    expect(updates[0]?.routingDecision.adjustment).toBe('disconnected');
    expect(updates[0]?.providerOverride).toBe('anthropic');
    expect(updates[0]?.routingLock).toBeNull();
    expect(executions).toHaveLength(1);
    expect(executions[0]?.agentId).toBe('child-1');
    expect(executions[0]?.provider).toBe('anthropic');
    expect(executions[0]?.model).toBe(updates[0]?.modelOverride);
    expect(executions[0]?.args.length).toBeGreaterThan(0);
  });

  it('availability changes before activation: a locked child blocks', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const running = container({ status: 'running' });
    const child = childAgent({
      id: 'child-1',
      ordinal: 1,
      status: 'pending',
      name: 'heavy rewrite',
      providerOverride: 'codex',
      modelOverride: 'gpt-5.6-sol',
      effort: 'high',
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    });
    const { state, set, get, sendTurn, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [running, child] },
      sessionPlans: { [SID]: [plan({ clusters: storedClusters, status: 'active' })] },
      providers: [{ id: 'anthropic', connection: 'connected' }],
    });
    hoisted.invokeAgentList.mockImplementation(backendRows({ base: [running, child] }));
    const executions = captureExecutions({ state, sendTurn });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: running });

    expect(resumed).toBe(false);
    expect(executions).toHaveLength(0);
    expect(routingUpdates()).toHaveLength(0);
    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'cluster blocked: heavy rewrite',
      expect.stringContaining('codex/gpt-5.6-sol'),
      { sessionId: SID },
    );
  });

  it('availability changes before activation: a hard budget spawns nothing', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const c = container();
    const { state, get, set, sendTurn, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      providers: CONNECTED_PROVIDERS,
      budgetAlerts: [
        {
          id: 'alert-1',
          kind: 'session-exceeded',
          sessionId: SID,
          currentUsd: 12,
          capUsd: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const executions = captureExecutions({ state, sendTurn });

    await fanOutClusters(set, get, SID, c, storedClusters, 'goal');

    expect(hoisted.insertArgs).toHaveLength(0);
    expect(hoisted.invokeAgentInsertBatch).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(executions).toHaveLength(0);
    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'cluster blocked: container',
      expect.any(String),
      { sessionId: SID },
    );
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
    expect(call.content).toContain('**Resume**');
    expect(call.content).toContain('**Scope** this cluster only');
    expect(call.content).toContain('<<cluster-done id="cont-a">>');
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
    expect(store.sendTurn).toHaveBeenCalledTimes(1);
    expect(store.emitNotification).not.toHaveBeenCalled();

    await advance(SID, 'cont-b' as AgentId, 'no marker 2');
    expect(store.sendTurn).toHaveBeenCalledTimes(1);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith('cont-b', {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(store.emitNotification).toHaveBeenCalled();
    expect(store.refreshUnreadWorkspaces).toHaveBeenCalled();
  });

  it('does not continue and pauses the child when hands-free is off', async () => {
    const child = childAgent({ id: 'cont-c', ordinal: 0 });
    const p = plan({});
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: { [SID]: [p] },
      sessions: [sessionRow(false)],
    });

    await advanceClusterImplementation(store.set, store.get)(SID, 'cont-c' as AgentId, 'no marker');

    expect(store.sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith('cont-c', {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      expect.stringContaining('cluster paused'),
      expect.stringContaining('autorun is off'),
      { sessionId: SID },
    );
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

  it('uses the container plan consumption when the plan has a workflow run and the children do not', async () => {
    const c0 = childAgent({ id: 'scope0', ordinal: 0 });
    const c1 = childAgent({ id: 'scope1', ordinal: 1 });
    const scopedPlan = plan({ id: 'scoped-plan', workflowRunId: 'R' as WorkflowRunId });
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [scopedPlan] },
      planConsumptions: {
        [scopedPlan.id]: [
          {
            id: 'scope-consumption',
            planId: scopedPlan.id,
            agentId: PARENT,
            agentName: 'container',
            consumedAt: '2026-01-01T00:00:00.000Z',
          } as PlanConsumption,
        ],
      },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'scope0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(set, get)(SID, c0.id, done('scope0'));

    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as {
      agentId: AgentId;
      content: string;
    };
    expect(call.agentId).toBe(c1.id);
    expect(call.content).toContain('do 1');
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalledWith(
      c1.id,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('hydrates the container plan consumption when the plan has no workflow run and the child does', async () => {
    const c0 = childAgent({
      id: 'mirror0',
      ordinal: 0,
      workflowRunId: 'R' as WorkflowRunId,
    });
    const c1 = childAgent({
      id: 'mirror1',
      ordinal: 1,
      workflowRunId: 'R' as WorkflowRunId,
    });
    const unscopedPlan = plan({ id: 'unscoped-plan' });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [unscopedPlan] },
    });
    hoisted.invokeListConsumptionsForPlan.mockResolvedValue([
      {
        id: 'mirror-consumption',
        planId: unscopedPlan.id,
        agentId: PARENT,
        agentName: 'container',
        consumedAt: '2026-01-01T00:00:00.000Z',
      } as PlanConsumption,
    ]);
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({
        id: 'mirror0',
        ordinal: 0,
        status: 'completed',
        workflowRunId: 'R' as WorkflowRunId,
      }),
      c1,
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, c0.id, done('mirror0'));

    const call = (store.sendTurn.mock.calls[0]! as unknown[])[0] as {
      agentId: AgentId;
      content: string;
    };
    expect(hoisted.invokeListConsumptionsForPlan).toHaveBeenCalledWith(unscopedPlan.id);
    expect(call.agentId).toBe(c1.id);
    expect(call.content).toContain('do 1');
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalledWith(
      c1.id,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('force-advances past a missing marker: completes the child and starts the next', async () => {
    const c0 = childAgent({ id: 'f0', ordinal: 0, status: 'running' });
    const c1 = childAgent({ id: 'f1', ordinal: 1 });
    const p = plan({});
    const { get, set, sendTurn, state } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [p] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'f0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(set, get)(SID, 'f0' as AgentId, 'no marker here', {
      force: true,
    });

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'f0',
      expect.objectContaining({ status: 'completed' }),
    );
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { agentId: AgentId; content: string };
    expect(call.agentId).toBe('f1');
    expect(call.content).toContain('2/2');
    expect(state.selectedAgentId).toBe(PARENT);
  });

  it('stores a successful model summary without a degraded notification', async () => {
    const child = childAgent({
      id: 'summary-child',
      ordinal: 0,
      status: 'running',
      name: 'summary-child',
    });
    const assistantText = 'completed the cluster';
    const { get, set, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: { [SID]: [plan({})] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'summary-child', ordinal: 0, status: 'completed' }),
    ]);

    await advanceClusterImplementation(set, get)(SID, child.id, assistantText, { force: true });

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      child.id,
      expect.objectContaining({
        outputSummary: 'model summary',
      }),
    );
    expect(hoisted.summarizeAgentOutput).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: child.id, output: assistantText }),
    );
    expect(emitNotification).not.toHaveBeenCalledWith(
      'summarizer-degraded',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('stores the fallback and emits one keyed warning when summarization fails', async () => {
    const child = childAgent({
      id: 'degraded-child',
      ordinal: 0,
      status: 'running',
      workflowRunId: 'wf-1' as WorkflowRunId,
      stepId: 'step-1' as StepId,
    });
    const { get, set, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
    });
    hoisted.summarizeAgentOutput.mockResolvedValue({
      summary: 'deterministic fallback',
      degraded: true,
      error: 'provider failed',
    } as { summary: string; degraded: boolean });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'degraded-child', ordinal: 0, status: 'completed' }),
    ]);

    await advanceClusterImplementation(set, get)(SID, child.id, 'raw output', { force: true });

    expect(emitNotification).toHaveBeenCalledTimes(1);
    expect(emitNotification).toHaveBeenCalledWith(
      'summarizer-degraded',
      'warning',
      expect.stringContaining('child-0'),
      expect.stringContaining('provider failed'),
      {
        sessionId: SID,
        action: { kind: 'retry-step-summary', sessionId: SID, agentId: child.id },
        coalesceKey: 'step-summary-degraded:wf-1:step-1',
      },
    );
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      child.id,
      expect.objectContaining({ outputSummary: 'deterministic fallback' }),
    );
  });

  it('does not notify degraded when the child advances with no output to summarize', async () => {
    const child = childAgent({ id: 'manual-advance', ordinal: 0, status: 'running' });
    const { get, set, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: { [SID]: [plan({})] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'manual-advance', ordinal: 0, status: 'completed' }),
    ]);

    await advanceClusterImplementation(set, get)(SID, child.id, '', { force: true });

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      child.id,
      expect.objectContaining({ outputSummary: 'advanced to next cluster manually' }),
    );
    expect(emitNotification).not.toHaveBeenCalledWith(
      'summarizer-degraded',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('kicks off the next cluster with its instructions even after the plan flipped to consumed', async () => {
    const c0 = childAgent({ id: 'cu0', ordinal: 0 });
    const c1 = childAgent({ id: 'cu1', ordinal: 1 });
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [plan({ status: 'consumed', consumptionCount: 1 })] },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'cu0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(set, get)(SID, 'cu0' as AgentId, done('cu0'));

    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as { content: string };
    expect(call.content).toContain('2/2');
    expect(call.content).toContain('c1');
    expect(call.content).toContain('do 1');
    expect(call.content).toContain('**Goal** goal');
  });

  it('hydrates the plans from the db when the store has none for the session', async () => {
    const c0 = childAgent({ id: 'hy0', ordinal: 0 });
    const c1 = childAgent({ id: 'hy1', ordinal: 1 });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: {},
    });
    store.state.loadSessionPlans = vi.fn(async () => {
      store.state.sessionPlans = { [SID]: [plan({ status: 'consumed' })] };
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'hy0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, 'hy0' as AgentId, done('hy0'));

    const call = (store.sendTurn.mock.calls[0]! as unknown[])[0] as { content: string };
    expect(call.content).toContain('do 1');
  });

  it('completes the child when plan consumption hydration fails', async () => {
    const c0 = childAgent({ id: 'db-hydrate-0', ordinal: 0 });
    const c1 = childAgent({ id: 'db-hydrate-1', ordinal: 1 });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: { [SID]: [plan({})] },
    });
    hoisted.invokeListConsumptionsForPlan.mockRejectedValueOnce(new Error('read failed'));
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'db-hydrate-0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, c0.id, done('db-hydrate-0'));

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      c0.id,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(store.sendTurn).toHaveBeenCalledTimes(1);
  });

  it('completes the child when reloading session plans fails', async () => {
    const child = childAgent({ id: 'db-reload-0', ordinal: 0 });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), child] },
      sessionPlans: {},
    });
    store.state.loadSessionPlans = vi.fn(async () => {
      throw new Error('read failed');
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'db-reload-0', ordinal: 0, status: 'completed' }),
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, child.id, done('db-reload-0'));

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      child.id,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      PARENT,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('blocks the next child instead of sending an instruction-less kickoff when no plan is readable', async () => {
    const c0 = childAgent({ id: 'nb0', ordinal: 0 });
    const c1 = childAgent({ id: 'nb1', ordinal: 1 });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: {},
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      childAgent({ id: 'nb0', ordinal: 0, status: 'completed' }),
      c1,
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, 'nb0' as AgentId, done('nb0'));

    expect(store.sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith('nb1', {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      expect.stringContaining('cluster blocked'),
      expect.stringContaining('no instructions'),
      { sessionId: SID },
    );
  });

  it('fails the container and notifies when the plan has more clusters than children', async () => {
    const c0 = childAgent({ id: 'short-0', ordinal: 0, status: 'completed' });
    const c1 = childAgent({ id: 'short-1', ordinal: 1 });
    const store = makeStore({
      sessionPhaseRuns: { [SID]: [container({ status: 'running' }), c0, c1] },
      sessionPlans: {
        [SID]: [
          plan({
            clusters: [
              { title: 'c0', instructions: 'do 0' },
              { title: 'c1', instructions: 'do 1' },
              { title: 'c2', instructions: 'do 2' },
            ],
          }),
        ],
      },
    });
    hoisted.invokeAgentList.mockResolvedValue([
      container({ status: 'running' }),
      c0,
      childAgent({ id: 'short-1', ordinal: 1, status: 'completed' }),
    ]);

    await advanceClusterImplementation(store.set, store.get)(SID, c1.id, done('short-1'));

    expect(store.sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(PARENT, {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'cluster blocked: missing implementer',
      expect.stringContaining('more clusters'),
      { sessionId: SID },
    );
    expect(store.maybeAutoAdvanceWorkflow).not.toHaveBeenCalled();
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

describe('unsettledClusterChildren', () => {
  it('counts every child that has not reached a settled status', () => {
    const runs = [
      container(),
      childAgent({ id: 'c0', ordinal: 1, status: 'completed' }),
      childAgent({ id: 'c1', ordinal: 2, status: 'skipped' }),
      childAgent({ id: 'c2', ordinal: 3, status: 'pending' }),
      childAgent({ id: 'c3', ordinal: 4, status: 'running' }),
      childAgent({ id: 'c4', ordinal: 5, status: 'failed' }),
    ];

    expect(unsettledClusterChildren(runs, PARENT).map((child) => child.id)).toEqual([
      'c2',
      'c3',
      'c4',
    ]);
  });

  it('is empty for a container whose children all settled', () => {
    const runs = [container(), childAgent({ id: 'c0', ordinal: 1, status: 'completed' })];

    expect(unsettledClusterChildren(runs, PARENT)).toHaveLength(0);
  });
});

describe('resumeClusterChildren', () => {
  const consumedPlan = plan({ status: 'consumed', workflowRunId: 'wf-1' as WorkflowRunId });

  it('starts the first pending child from the plan the container already consumed', async () => {
    const c = container({ status: 'pending', workflowRunId: 'wf-1' as WorkflowRunId });
    const children = [
      childAgent({ id: 'c0', ordinal: 1, status: 'completed' }),
      childAgent({ id: 'c1', ordinal: 2, status: 'pending' }),
    ];
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c, ...children] },
      sessionPlans: { [SID]: [consumedPlan] },
      planConsumptions: { p1: [{ agentId: PARENT }] },
    });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: c });

    expect(resumed).toBe(true);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(PARENT, { status: 'running' });
    const call = (sendTurn.mock.calls[0]! as unknown[])[0] as {
      sessionId: SessionId;
      agentId: AgentId;
      content: string;
    };
    expect(call.sessionId).toBe(SID);
    expect(call.agentId).toBe('c1');
    expect(call.content).toContain('do 1');
    expect(call.content).toContain('<<cluster-done id="c1">>');
  });

  it('does nothing when the next unsettled child is already in flight', async () => {
    const c = container({ status: 'running', workflowRunId: 'wf-1' as WorkflowRunId });
    const children = [childAgent({ id: 'c0', ordinal: 1, status: 'running' })];
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c, ...children] },
      sessionPlans: { [SID]: [consumedPlan] },
      planConsumptions: { p1: [{ agentId: PARENT }] },
    });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: c });

    expect(resumed).toBe(false);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('returns false when every child already settled', async () => {
    const c = container({ status: 'running', workflowRunId: 'wf-1' as WorkflowRunId });
    const children = [childAgent({ id: 'c0', ordinal: 1, status: 'completed' })];
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c, ...children] },
      sessionPlans: { [SID]: [consumedPlan] },
      planConsumptions: { p1: [{ agentId: PARENT }] },
    });

    expect(await resumeClusterChildren({ set, get, sessionId: SID, container: c })).toBe(false);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('fails the child and warns when the plan no longer carries its instructions', async () => {
    const c = container({ status: 'pending', workflowRunId: 'wf-1' as WorkflowRunId });
    const children = [childAgent({ id: 'c0', ordinal: 1, status: 'pending' })];
    const { get, set, sendTurn, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [c, ...children] },
      sessionPlans: { [SID]: [] },
      planConsumptions: {},
    });

    const resumed = await resumeClusterChildren({ set, get, sessionId: SID, container: c });

    expect(resumed).toBe(false);
    expect(sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'c0',
      expect.objectContaining({ status: 'failed' }),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'cluster blocked: child-1',
      expect.any(String),
      { sessionId: SID },
    );
  });
});

describe('cluster child start retry', () => {
  const withUniqueChildIds = (prefix: string) => {
    hoisted.invokeAgentInsertBatch.mockImplementation(
      async ({ children }: { children: ReadonlyArray<Record<string, unknown>> }) => {
        const agents = children.map((args, index) => {
          hoisted.insertArgs.push(args);
          return {
            id: `${prefix}-${index + 1}` as AgentId,
            ...args,
          } as unknown as Agent;
        });
        return { inserted: true, agents };
      },
    );
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a transient start failure with backoff, then fails the child after the cap', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    vi.useFakeTimers();
    withUniqueChildIds('retry-a');
    const c = container({ id: 'container-a' as AgentId });
    const { get, set, sendTurn, emitNotification } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      clusterStartAttempts: {},
    });
    sendTurn.mockRejectedValue(new Error('spawn ETIMEDOUT'));

    await fanOutClusters(set, get, SID, c, clusters, 'goal');
    await vi.advanceTimersByTimeAsync(0);
    expect(sendTurn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(sendTurn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(8_000);
    expect(sendTurn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(sendTurn).toHaveBeenCalledTimes(3);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'retry-a-1',
      expect.objectContaining({ status: 'failed' }),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      expect.stringContaining('cluster could not start'),
      expect.any(String),
      { sessionId: SID },
    );
  });

  it('does not retry a deterministic start failure', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    vi.useFakeTimers();
    withUniqueChildIds('retry-b');
    const c = container({ id: 'container-b' as AgentId });
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      clusterStartAttempts: {},
    });
    sendTurn.mockRejectedValue(new Error('no agent selected. spawn one before sending a turn'));

    await fanOutClusters(set, get, SID, c, clusters, 'goal');
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'retry-b-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('never retries a turn that already produced work, so a long run is not replayed', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    vi.useFakeTimers();
    withUniqueChildIds('retry-c');
    const c = container({ id: 'container-c' as AgentId });
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      clusterStartAttempts: {},
      transcripts: { 'retry-c-1': [{ kind: 'assistant_text', delta: 'work' }] },
    });
    sendTurn.mockRejectedValue(new Error('stream closed'));

    await fanOutClusters(set, get, SID, c, clusters, 'goal');
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'retry-c-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('records the attempt number in the store so the stepper can show it', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'false');
    vi.useFakeTimers();
    withUniqueChildIds('retry-d');
    const c = container({ id: 'container-d' as AgentId });
    const { get, set, sendTurn } = makeStore({
      sessionPhaseRuns: { [SID]: [c] },
      clusterStartAttempts: {},
    });
    sendTurn.mockRejectedValue(new Error('spawn ETIMEDOUT'));

    await fanOutClusters(set, get, SID, c, clusters, 'goal');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);

    expect((get().clusterStartAttempts as unknown as Record<string, number>)['retry-d-1']).toBe(2);
  });
});
