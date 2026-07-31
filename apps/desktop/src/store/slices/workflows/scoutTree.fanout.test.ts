import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
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

import { SCOUT_MAX_CHILDREN, advanceScoutTree, fanOutScouts } from './scoutTree';

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
  Array.from({ length: n }, (_, i) => ({ area: `area-${i}`, query: `q-${i}` }));

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

  it('caps fan-out at SCOUT_MAX_CHILDREN, still propagating workflowRunId, and notifies on drop', async () => {
    const c = container({ workflowRunId: 'wf-9' as WorkflowRunId });
    const { get, set, emitNotification } = makeStore(c);

    await fanOutScouts(set, get, SID, c, areas(SCOUT_MAX_CHILDREN + 2));

    expect(hoisted.insertArgs).toHaveLength(SCOUT_MAX_CHILDREN);
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
    workspaceOverrides: { [WS]: { scoutFanout: fanout } },
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
  return { state, get, set, sendTurn };
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
    '<<scout-split>>',
    JSON.stringify(Array.from({ length: n }, (_, i) => ({ area: `area-${i}`, query: `q-${i}` }))),
    '<</scout-split>>',
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
    expect(payload.content).toContain('do not split');
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
    const scout = scoutAgent({ id: 'summary-scout' as AgentId });
    const assistantText = `${'h'.repeat(1500)}middle${'t'.repeat(400)}`;
    const { get, set } = makeAdvanceStore([scout], true);

    await advanceScoutTree(set, get)(SID, scout.id, assistantText);

    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      scout.id,
      expect.objectContaining({
        outputSummary: `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`,
      }),
    );
  });
});
