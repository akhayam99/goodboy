import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ContextSlot,
  IsoDateTime,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

const { scoutPlan, insertBatch, agentList, updateStatus, recordProvenance } = vi.hoisted(() => ({
  scoutPlan: vi.fn(),
  insertBatch: vi.fn(),
  agentList: vi.fn(),
  updateStatus: vi.fn(),
  recordProvenance: vi.fn(async () => undefined),
}));

vi.mock('../../../features/wireframes/collectWireframeScoutPlan', () => ({
  collectWireframeScoutPlan: scoutPlan,
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsertBatch: insertBatch,
  invokeAgentList: agentList,
  invokeAgentUpdateStatus: updateStatus,
}));

vi.mock('../workflowRouting/agentEmittingProvider', () => ({
  agentEmittingProvider: () => null,
}));

vi.mock('../workflows/childRoutingBatch', () => ({
  childRoutingBatch: () => ({
    kind: 'ready',
    entries: [
      {
        routingLock: null,
        routingDecision: null,
        taskProfile: null,
        providerOverride: null,
        modelOverride: null,
        effort: null,
      },
      {
        routingLock: null,
        routingDecision: null,
        taskProfile: null,
        providerOverride: null,
        modelOverride: null,
        effort: null,
      },
    ],
  }),
}));

vi.mock('../../../features/artifacts/artifactProvenance', async () => {
  const actual = await vi.importActual<
    typeof import('../../../features/artifacts/artifactProvenance')
  >('../../../features/artifacts/artifactProvenance');
  return {
    artifactEvidenceInventory: actual.artifactEvidenceInventory,
    recordArtifactProvenance: recordProvenance,
  };
});

vi.mock('../../../features/worktree/worktree', () => ({
  listBranchCommits: async () => [],
  worktreeChangedFiles: async () => ({ paths: [], additions: 0, deletions: 0 }),
}));

vi.mock('../../../features/explore/explore', () => ({
  exploreList: async ({ relPath }: { readonly relPath: string }) =>
    relPath === 'apps/web/src' ? [{ name: 'Batches.tsx' }] : [],
  exploreRead: async () => {
    throw new Error('missing');
  },
}));

import { WIREFRAME_SCOUTS } from '../../../features/wireframes/wireframeScoutRoles';
import {
  WIREFRAME_SCOUT_DEADLINE_MS,
  WIREFRAME_SCOUT_DEADLINE_REASON,
  WIREFRAME_SCOUT_RESTART_REASON,
} from '../../../features/wireframes/wireframeScoutReports';
import { advanceScoutTree } from '../workflows/scoutTree';
import { spawnWireframeAgent } from './spawnWireframeAgent';
import {
  expireWireframeScouts,
  joinWireframeScouts,
  recoverWireframeScouts,
  resetWireframeScoutRegistry,
  startWireframeScouts,
  stopArtifactGeneration,
  WIREFRAME_SCOUT_RESTART_SUMMARY,
} from './wireframeScouts';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'redraw the batch review flow',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const READY_PLAN = {
  plan: {
    kind: 'ready',
    root: 'apps/web',
    rootReason: '"web" names this workspace',
    scouts: WIREFRAME_SCOUTS,
    modelLabel: 'Claude Haiku 4.5',
  },
  gate: { kind: 'ready', worktreePath: '/tmp/worktree', modelLabel: 'Claude Haiku 4.5' },
};

const SKIPPED_PLAN = (reason: string) => ({
  plan: { kind: 'skipped', reason },
  gate: { kind: 'skipped', reason },
});

type Harness = Readonly<{
  state: Record<string, unknown>;
  agents: Array<Agent>;
  sendTurn: ReturnType<typeof vi.fn>;
  spawnAgent: ReturnType<typeof vi.fn>;
  cancelCurrentTurn: ReturnType<typeof vi.fn>;
  get: GetFn;
  set: SetFn;
}>;

let counter = 0;

const harness = (): Harness => {
  counter += 1;
  const containerId = `container-${counter}` as AgentId;
  const agents: Array<Agent> = [];
  const sendTurn = vi.fn(async () => undefined);
  const cancelCurrentTurn = vi.fn(async () => undefined);
  const spawnAgent = vi.fn(async (_sessionId: SessionId, args: Record<string, unknown>) => {
    agents.push({
      id: containerId,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: String(args['name'] ?? 'Low fidelity'),
      kind: 'wireframe',
      status: 'pending',
      createdAt: NOW,
    } as Agent);
    return containerId;
  });
  const state: Record<string, unknown> = {
    sessions: [session],
    sessionPhaseRuns: { [SESSION_ID]: agents as ReadonlyArray<Agent> },
    transcripts: {},
    agentTurnState: {},
    agentKindOverride: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    selectedAgentId: {},
    sessionArtifacts: {},
    wireframeScoutVerification: {},
    workspaceOverrides: {},
    providers: [{ id: 'anthropic', connection: 'connected' }],
    providerCooldowns: {},
    budgetAlerts: [],
    sessionMounts: {},
    sessionProjectMounts: {},
    sessionActiveMount: {},
    sessionActiveProject: {},
    mountBranchObservations: {},
    sessionSlots: {} as Record<string, ReadonlyArray<ContextSlot>>,
    spawnAgent,
    sendTurn,
    cancelCurrentTurn,
    emitNotification: vi.fn(async () => undefined),
    refreshUnreadWorkspaces: vi.fn(async () => undefined),
    ensureSessionSlots: async (): Promise<ReadonlyArray<ContextSlot>> => [],
  };
  const set = ((patch: unknown) => {
    const next =
      typeof patch === 'function'
        ? (patch as (current: Record<string, unknown>) => Record<string, unknown>)(state)
        : (patch as Record<string, unknown>);
    Object.assign(state, next);
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  state['startWireframeScouts'] = startWireframeScouts(set, get);
  state['joinWireframeScouts'] = joinWireframeScouts(set, get);
  state['expireWireframeScouts'] = expireWireframeScouts(set, get);
  state['recoverWireframeScouts'] = recoverWireframeScouts(set, get);
  state['stopArtifactGeneration'] = stopArtifactGeneration(set, get);
  state['advanceScoutTree'] = advanceScoutTree(set, get);
  state['spawnWireframeAgent'] = spawnWireframeAgent(get);
  return { state, agents, sendTurn, spawnAgent, cancelCurrentTurn, get, set };
};

const childOf = ({
  agents,
  name,
}: {
  readonly agents: ReadonlyArray<Agent>;
  name: string;
}): Agent => agents.find((agent) => agent.name === name)!;

beforeEach(() => {
  vi.clearAllMocks();
  resetWireframeScoutRegistry();
  scoutPlan.mockResolvedValue(READY_PLAN);
  insertBatch.mockImplementation(
    async ({
      parentAgentId,
      children,
    }: {
      readonly parentAgentId: AgentId;
      readonly children: ReadonlyArray<Record<string, unknown>>;
    }) => {
      const inserted = children.map(
        (child, index) =>
          ({
            id: `${parentAgentId}-child-${index}` as AgentId,
            sessionId: SESSION_ID,
            parentAgentId,
            ordinal: Number(child['ordinal'] ?? index + 1),
            name: String(child['name']),
            kind: 'scout',
            status: 'pending',
            createdAt: NOW,
          }) as Agent,
      );
      return { inserted: true, agents: inserted };
    },
  );
});

const spawn = async (h: Harness): Promise<AgentId> => {
  const listed = h.agents;
  agentList.mockImplementation(async () => [...listed]);
  insertBatch.mockImplementation(
    async ({
      parentAgentId,
      children,
    }: {
      readonly parentAgentId: AgentId;
      readonly children: ReadonlyArray<Record<string, unknown>>;
    }) => {
      const inserted = children.map(
        (child, index) =>
          ({
            id: `${parentAgentId}-child-${index}` as AgentId,
            sessionId: SESSION_ID,
            parentAgentId,
            ordinal: Number(child['ordinal'] ?? index + 1),
            name: String(child['name']),
            kind: 'scout',
            status: 'pending',
            createdAt: NOW,
          }) as Agent,
      );
      listed.push(...inserted);
      return { inserted: true, agents: inserted };
    },
  );
  updateStatus.mockImplementation(async (agentId: AgentId, patch: Record<string, unknown>) => {
    const index = listed.findIndex((agent) => agent.id === agentId);
    if (index >= 0) {
      listed[index] = { ...listed[index]!, ...patch } as Agent;
    }
  });
  return (h.state['spawnWireframeAgent'] as (args: Record<string, unknown>) => Promise<AgentId>)({
    sessionId: SESSION_ID,
    fidelity: 'low',
    attachments: [],
    focus: 'none',
  });
};

describe('wireframe scouting gate', () => {
  it('takes the single agent path unchanged when no repository is mounted', async () => {
    scoutPlan.mockResolvedValue(SKIPPED_PLAN('no mounted project, so nothing is scouted'));
    const h = harness();
    await spawn(h);
    expect(h.spawnAgent).toHaveBeenCalledTimes(1);
    const args = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(String(args['initialPrompt']).length).toBeGreaterThan(0);
    expect(insertBatch).not.toHaveBeenCalled();
  });

  it('takes the single agent path when scout routing is blocked', async () => {
    scoutPlan.mockResolvedValue(SKIPPED_PLAN('scout routing is blocked, so nothing is scouted: x'));
    const h = harness();
    await spawn(h);
    expect(insertBatch).not.toHaveBeenCalled();
    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('takes the single agent path when the session is budget blocked', async () => {
    scoutPlan.mockResolvedValue(
      SKIPPED_PLAN('this session is budget blocked, so nothing is scouted'),
    );
    const h = harness();
    await spawn(h);
    expect(insertBatch).not.toHaveBeenCalled();
  });

  it('names the skip reason in the pack it sends instead', async () => {
    scoutPlan.mockResolvedValue(SKIPPED_PLAN('no mounted project, so nothing is scouted'));
    const h = harness();
    await spawn(h);
    const args = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(String(args['initialPrompt'])).toContain('wireframe request');
  });
});

describe('wireframe scout spawn', () => {
  it('starts both scouts at once and sends the container no turn at all', async () => {
    const h = harness();
    const containerId = await spawn(h);
    const spawnArgs = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(spawnArgs['initialPrompt']).toBeUndefined();
    expect(insertBatch).toHaveBeenCalledTimes(1);
    const inserted = insertBatch.mock.calls[0]![0] as {
      readonly children: ReadonlyArray<Record<string, unknown>>;
    };
    expect(inserted.children.map((child) => child['name'])).toEqual([
      'screens and routes',
      'data and contracts',
    ]);
    expect(inserted.children.every((child) => child['kind'] === 'scout')).toBe(true);
    const turns = h.sendTurn.mock.calls.map(
      (call) => (call[0] as Record<string, unknown>)['agentId'],
    );
    expect(turns).toHaveLength(2);
    expect(turns).not.toContain(containerId);
  });

  it('pins the same root into both kickoffs', async () => {
    const h = harness();
    await spawn(h);
    const kickoffs = h.sendTurn.mock.calls.map((call) =>
      String((call[0] as Record<string, unknown>)['content']),
    );
    expect(kickoffs).toHaveLength(2);
    expect(kickoffs.every((text) => text.includes('**Root** apps/web'))).toBe(true);
  });
});

describe('wireframe scout join', () => {
  const settle = async (h: Harness, name: string, text: string): Promise<void> => {
    const child = childOf({ agents: h.agents, name });
    await (
      h.state['advanceScoutTree'] as (
        sessionId: SessionId,
        agentId: AgentId,
        assistantText: string,
      ) => Promise<void>
    )(SESSION_ID, child.id, text);
  };

  it('waits for the last child, then sends the container exactly one turn', async () => {
    const h = harness();
    const containerId = await spawn(h);
    h.sendTurn.mockClear();

    await settle(h, 'screens and routes', 'the batch list renders totals apps/web/src/Batches.tsx');
    expect(h.sendTurn).not.toHaveBeenCalled();

    await settle(h, 'data and contracts', 'the batch type carries a total apps/web/src/Ghost.ts');
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('## scout reports');
    expect(pack).toContain('rooted at apps/web');
    expect(pack).toContain('the batch list renders totals');
  });

  it('puts the verification header on a report and records the claim count', async () => {
    const h = harness();
    await spawn(h);
    await settle(h, 'screens and routes', 'the batch list renders totals apps/web/src/Batches.tsx');
    await settle(h, 'data and contracts', 'nothing worth a path here');
    const pack = String((h.sendTurn.mock.calls.at(-1)![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('verified 1 of 1 cited paths');
    const verification = h.state['wireframeScoutVerification'] as Record<string, unknown>;
    expect(Object.values(verification)).toContainEqual({ verified: 1, cited: 1 });
  });

  it('demotes a report whose cited paths mostly could not be found', async () => {
    const h = harness();
    await spawn(h);
    await settle(
      h,
      'screens and routes',
      [
        'claim one apps/web/src/Ghost.tsx',
        'claim two apps/web/src/Phantom.tsx',
        'claim three apps/web/src/Batches.tsx',
      ].join('\n'),
    );
    await settle(h, 'data and contracts', 'a real one apps/web/src/Batches.tsx');
    const pack = String((h.sendTurn.mock.calls.at(-1)![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('most of what it reported could not be found on disk');
  });

  it('never splits a wireframe scout, whatever it emits', async () => {
    const h = harness();
    await spawn(h);
    h.sendTurn.mockClear();
    insertBatch.mockClear();
    await settle(
      h,
      'screens and routes',
      '<<fan-out>>\n- area one: look here\n- area two: look there\n<</fan-out>>',
    );
    expect(insertBatch).not.toHaveBeenCalled();
    expect(childOf({ agents: h.agents, name: 'screens and routes' }).status).toBe('completed');
  });
});

describe('wireframe scout deadline', () => {
  it('cancels the run of a scout that never reported, then joins', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      const containerId = await spawn(h);
      h.sendTurn.mockClear();
      const child = childOf({ agents: h.agents, name: 'screens and routes' });
      await (
        h.state['advanceScoutTree'] as (
          sessionId: SessionId,
          agentId: AgentId,
          assistantText: string,
        ) => Promise<void>
      )(SESSION_ID, child.id, 'the batch list apps/web/src/Batches.tsx');
      await vi.advanceTimersByTimeAsync(WIREFRAME_SCOUT_DEADLINE_MS + 1);
      const late = childOf({ agents: h.agents, name: 'data and contracts' });
      expect(h.cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, late.id);
      expect(late.status).toBe('skipped');
      expect(late.outputSummary).toBe(WIREFRAME_SCOUT_DEADLINE_REASON);
      const containerTurns = h.sendTurn.mock.calls.filter(
        (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
      );
      expect(containerTurns).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('stopping a wireframe generation', () => {
  it('cancels the children as well as the container', async () => {
    const h = harness();
    const containerId = await spawn(h);
    await (h.state['stopArtifactGeneration'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
      agentId: containerId,
    });
    expect(h.cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, containerId);
    for (const scout of WIREFRAME_SCOUTS) {
      const child = childOf({ agents: h.agents, name: scout.name });
      expect(h.cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, child.id);
      expect(child.status).toBe('skipped');
    }
  });
});

describe('recovering a container after a restart', () => {
  it('settles the children and fails the container it can no longer wait for', async () => {
    const h = harness();
    const containerId = await spawn(h);
    resetWireframeScoutRegistry();
    await (h.state['recoverWireframeScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
    });
    for (const scout of WIREFRAME_SCOUTS) {
      const child = childOf({ agents: h.agents, name: scout.name });
      expect(child.status).toBe('skipped');
      expect(child.outputSummary).toBe(WIREFRAME_SCOUT_RESTART_REASON);
    }
    const container = h.agents.find((agent) => agent.id === containerId)!;
    expect(container.status).toBe('failed');
    expect(container.outputSummary).toBe(WIREFRAME_SCOUT_RESTART_SUMMARY);
  });

  it('leaves a container this process is still waiting on alone', async () => {
    const h = harness();
    const containerId = await spawn(h);
    await (h.state['recoverWireframeScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
    });
    expect(h.agents.find((agent) => agent.id === containerId)!.status).toBe('running');
  });
});
