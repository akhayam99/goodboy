import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
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
  };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsertBatch: hoisted.invokeAgentInsertBatch,
  invokeAgentList: hoisted.invokeAgentList,
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
  invokeWorkflowNodeRoutingUpdate: hoisted.invokeWorkflowNodeRoutingUpdate,
}));

import { FAN_OUT_MAX_CHILDREN, advanceScoutTree, fanOutScouts } from './scoutTree';

const SID = 'sess-1' as SessionId;

const container = (over: Partial<Agent> = {}): Agent => ({
  id: 'container' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'root scout',
  status: 'running',
  kind: 'scout',
  ...over,
});

const areas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    area: `area-${i}`,
    query: `q-${i}`,
    module: null,
    fixtures: [],
    topFrame: null,
    sharedFrames: [],
  }));

function makeStore(c: Agent) {
  const sendTurn = vi.fn(async (_args: { content: string }) => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: [c] },
    agentModelOverride: {},
    agentKindOverride: {},
    transcripts: {},
    agentTurnState: {},
    sessions: [],
    sendTurn,
    emitNotification,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set, sendTurn, emitNotification };
}

afterEach(() => {
  hoisted.insertArgs.length = 0;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('fanOutScouts workflowRunId propagation', () => {
  it('propagates the container workflowRunId to every spawned sub-scout', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(3));

    expect(hoisted.insertArgs).toHaveLength(3);
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-1');
    }
  });

  it('omits workflowRunId for an ad-hoc scout container that has none', async () => {
    const c = container();
    const { get, set } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(2));

    expect(hoisted.insertArgs).toHaveLength(2);
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBeUndefined();
    }
  });

  it('materializes every sub-scout through one parent-scoped batch', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(3));

    expect(hoisted.invokeAgentInsertBatch).toHaveBeenCalledTimes(1);
    const call = hoisted.invokeAgentInsertBatch.mock.calls[0]![0];
    expect(call.parentAgentId).toBe('container');
    expect(call.children).toHaveLength(3);
  });

  it('leaves no children and starts nothing when the batch fails', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set, sendTurn, state } = makeStore(c);
    hoisted.invokeAgentInsertBatch.mockRejectedValueOnce(new Error('database is locked'));

    await expect(fanOutScouts(set, get, SID, c, areas(3))).rejects.toThrow('database is locked');

    expect(hoisted.insertArgs).toHaveLength(0);
    expect(hoisted.invokeAgentList).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
    expect(Object.keys(state.transcripts as Record<string, unknown>)).toEqual([]);
  });

  it('does not start a second batch for a parent the backend already materialized', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set, sendTurn } = makeStore(c);
    hoisted.invokeAgentInsertBatch.mockResolvedValueOnce({ inserted: false, agents: [] });

    await fanOutScouts(set, get, SID, c, areas(3));

    expect(sendTurn).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(hoisted.invokeAgentList).not.toHaveBeenCalled();
  });

  it('spawns children as scouts parented to the container in this session', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(2));

    for (const args of hoisted.insertArgs) {
      expect(args.kind).toBe('scout');
      expect(args.parentAgentId).toBe('container');
      expect(args.sessionId).toBe(SID);
    }
  });

  it('kicks off a turn for each spawned sub-scout', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set, sendTurn } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(3));

    expect(sendTurn).toHaveBeenCalledTimes(3);
    for (const [args] of sendTurn.mock.calls) {
      expect(args.content).toContain('<<scout-domains keywords="auth,db,routing">>');
      expect(args.content).toContain('2 to 4 single-word keywords');
    }
  });

  it('does not fan out (no inserts, no status flip) for fewer than 2 areas', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId });
    const { get, set } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(1));

    expect(hoisted.insertArgs).toHaveLength(0);
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });

  it('caps fan-out at FAN_OUT_MAX_CHILDREN, still propagating workflowRunId, and notifies on drop', async () => {
    const c = container({ workflowRunId: 'wf-9' as WorkflowRunId });
    const { get, set, emitNotification } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(FAN_OUT_MAX_CHILDREN + 2));

    expect(hoisted.insertArgs).toHaveLength(FAN_OUT_MAX_CHILDREN);
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-9');
    }
    expect(emitNotification).toHaveBeenCalled();
  });
});

const WS = 'ws-1';

function makeAdvanceStore(runs: ReadonlyArray<Agent>, fanout: boolean) {
  const sendTurn = vi.fn(async (_args: { content: string }) => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const refreshUnreadWorkspaces = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: runs },
    agentModelOverride: {},
    agentKindOverride: {},
    transcripts: {},
    agentTurnState: {},
    sessionNudges: {},
    workspaceOverrides: { [WS]: { parallelAgents: fanout } },
    sessions: [{ id: SID, workspaceId: WS }],
    sendTurn,
    emitNotification,
    refreshUnreadWorkspaces,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set, sendTurn, emitNotification };
}

const scoutAgent = (over: Partial<Agent> = {}): Agent => ({
  id: 'scout' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'scout',
  status: 'running',
  kind: 'scout',
  ...over,
});

const splitText = (n: number) =>
  [
    '<<fan-out>>',
    JSON.stringify(Array.from({ length: n }, (_, i) => ({ area: `area-${i}`, query: `q-${i}` }))),
    '<</fan-out>>',
  ].join('\n');

describe('advanceScoutTree split decision', () => {
  it('fans out into sub-scouts when the domain is too large and fan-out is enabled', async () => {
    const root = scoutAgent({ id: 'root-on' as AgentId });
    const { get, set } = makeAdvanceStore([root], true);

    await advanceScoutTree(set, get)(SID, 'root-on' as AgentId, splitText(3));

    expect(hoisted.insertArgs).toHaveLength(3);
    for (const args of hoisted.insertArgs) {
      expect(args.kind).toBe('scout');
      expect(args.parentAgentId).toBe('root-on');
    }
  });

  it('self-explores in one agent without spawning sub-scouts when fan-out is disabled', async () => {
    const root = scoutAgent({ id: 'root-off' as AgentId });
    const { get, set, sendTurn } = makeAdvanceStore([root], false);

    await advanceScoutTree(set, get)(SID, 'root-off' as AgentId, splitText(3));

    expect(hoisted.insertArgs).toHaveLength(0);
    expect(sendTurn).toHaveBeenCalledTimes(1);
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toMatch(/do not split/i);
  });

  it('does not fan out past the depth cap even with a split marker', async () => {
    const root = scoutAgent({ id: 'r' as AgentId });
    const mid = scoutAgent({ id: 'm' as AgentId, parentAgentId: 'r' as AgentId });
    const leaf = scoutAgent({ id: 'leaf' as AgentId, parentAgentId: 'm' as AgentId });
    const { get, set } = makeAdvanceStore([root, mid, leaf], true);

    await advanceScoutTree(set, get)(SID, 'leaf' as AgentId, splitText(3));

    expect(hoisted.insertArgs).toHaveLength(0);
  });

  it('stores deterministic head and tail output for a completed scout', async () => {
    const scout = scoutAgent({ id: 'summary-scout' as AgentId, name: 'summary-scout' });
    const assistantText = `${'h'.repeat(1500)}middle${'t'.repeat(400)}`;
    const { get, set, emitNotification } = makeAdvanceStore([scout], true);

    await advanceScoutTree(set, get)(SID, scout.id, assistantText);

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      scout.id,
      expect.objectContaining({
        outputSummary: `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`,
      }),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      'summarizer-degraded',
      'warning',
      expect.stringContaining('summary-scout'),
      expect.any(String),
      {
        sessionId: SID,
        action: { kind: 'retry-step-summary', sessionId: SID, agentId: scout.id },
        coalesceKey: `step-summary-degraded:${scout.id}`,
      },
    );
  });

  it('notifies the degraded summary only once for the same scout (dedupe)', async () => {
    const scout = scoutAgent({ id: 'dedupe-scout' as AgentId });
    const { get, set, emitNotification } = makeAdvanceStore([scout], true);
    const advance = advanceScoutTree(set, get);

    await advance(SID, scout.id, 'raw output');
    await advance(SID, scout.id, 'raw output again');

    expect(emitNotification).toHaveBeenCalledTimes(1);
  });
});

const CONNECTED_PROVIDERS = [
  { id: 'anthropic', connection: 'connected' },
  { id: 'codex', connection: 'connected' },
];

const ROUTED_SESSION = {
  id: SID,
  workspaceId: WS,
  providerPreference: { defaultProvider: 'anthropic' },
  workflowRuns: [],
};

const mixedSplitText = [
  '<<fan-out>>',
  JSON.stringify([
    {
      area: 'auth',
      query: 'map the session guards',
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
      taskType: 'exploration',
      difficulty: 'heavy',
      modelReason: 'auth spans four packages',
    },
    {
      area: 'copy',
      query: 'list the settings strings',
      provider: 'anthropic',
      model: 'haiku-4.5',
      taskType: 'exploration',
      difficulty: 'light',
      modelReason: 'a string sweep needs no depth',
    },
  ]),
  '<</fan-out>>',
].join('\n');

function makeRoutedStore(runs: ReadonlyArray<Agent>) {
  const sendTurn = vi.fn(async (_args: { content: string }) => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const refreshUnreadWorkspaces = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: runs },
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    agentKindOverride: {},
    transcripts: {},
    agentTurnState: {},
    sessionNudges: {},
    workspaceOverrides: { [WS]: { parallelAgents: true } },
    sessions: [ROUTED_SESSION],
    providers: CONNECTED_PROVIDERS,
    providerCooldowns: {},
    budgetAlerts: [],
    sendTurn,
    emitNotification,
    refreshUnreadWorkspaces,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set, sendTurn, emitNotification };
}

describe('per-child fan-out routing', () => {
  it('siblings with different difficulty persist distinct provider-qualified picks', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const root = scoutAgent({ id: 'routed-root' as AgentId });
    const { get, set } = makeRoutedStore([root]);

    await advanceScoutTree(set, get)(SID, root.id, mixedSplitText);

    expect(hoisted.insertArgs).toHaveLength(2);
    expect(hoisted.insertArgs[0]?.modelOverride).toBe('opus-5');
    expect(hoisted.insertArgs[1]?.modelOverride).toBe('haiku-4.5');
    const first = hoisted.insertArgs[0]?.routingDecision as {
      readonly selected: { readonly provider: string; readonly model: string };
      readonly source: string;
    };
    expect(first.source).toBe('agent');
    expect(first.selected.provider).toBe('anthropic');
  });

  it('depth-two grandchildren are routed independently and cannot split again', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const root = scoutAgent({ id: 'gp' as AgentId });
    const mid = scoutAgent({ id: 'mid' as AgentId, parentAgentId: 'gp' as AgentId });
    const { get, set } = makeRoutedStore([root, mid]);

    await advanceScoutTree(set, get)(SID, mid.id, mixedSplitText);

    expect(hoisted.insertArgs).toHaveLength(2);
    expect(hoisted.insertArgs[0]?.modelOverride).toBe('opus-5');
    expect(hoisted.insertArgs[1]?.modelOverride).toBe('haiku-4.5');

    const leaf = scoutAgent({ id: 'leaf' as AgentId, parentAgentId: 'mid' as AgentId });
    const deeper = makeRoutedStore([root, mid, leaf]);
    hoisted.insertArgs.length = 0;

    await advanceScoutTree(deeper.set, deeper.get)(SID, leaf.id, mixedSplitText);

    expect(hoisted.insertArgs).toHaveLength(0);
  });

  it('rerender or repeated completion does not duplicate children', async () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const root = scoutAgent({ id: 'retry-root' as AgentId });
    const existingChild = scoutAgent({
      id: 'existing-child' as AgentId,
      ordinal: 1,
      parentAgentId: 'retry-root' as AgentId,
    });
    const { get, set } = makeRoutedStore([root, existingChild]);

    await advanceScoutTree(set, get)(SID, root.id, mixedSplitText);

    expect(hoisted.insertArgs).toHaveLength(0);
  });
});
