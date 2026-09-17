import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ContextSlot,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';

const {
  scoutPlan,
  changedFiles,
  insertBatch,
  agentList,
  updateStatus,
  provenanceRows,
  recordProvenance,
  loadProvenance,
  advanceRun,
} = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    scoutPlan: vi.fn(),
    changedFiles: vi.fn<
      (params: { readonly worktreePath: string; readonly baseBranch: string }) => Promise<{
        readonly paths: ReadonlyArray<string>;
        readonly additions: number;
        readonly deletions: number;
      }>
    >(async () => ({ paths: [], additions: 0, deletions: 0 })),
    insertBatch: vi.fn(),
    agentList: vi.fn(),
    updateStatus: vi.fn(),
    provenanceRows: rows,
    recordProvenance: vi.fn(async (args: Record<string, unknown>) => {
      rows.set(String(args['agentId']), { ...args });
    }),
    loadProvenance: vi.fn(async (agentId: string) => rows.get(agentId) ?? null),
    advanceRun: vi.fn(async (args: Record<string, unknown>) => {
      const agentId = String(args['agentId']);
      const current = rows.get(agentId);
      if (current === undefined) {
        return;
      }
      rows.set(agentId, { ...current, phase: args['phase'], scoutPlan: args['scoutPlan'] });
    }),
  };
});

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
    loadArtifactProvenance: loadProvenance,
    advanceArtifactRun: advanceRun,
  };
});

vi.mock('../../../features/worktree/worktree', () => ({
  listBranchCommits: async () => [],
  worktreeChangedFiles: changedFiles,
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
  WIREFRAME_SCOUT_NOTHING_USABLE,
  WIREFRAME_SCOUT_RESTART_REASON,
} from '../../../features/wireframes/wireframeScoutReports';
import { REPORT_SCOUT_NOTHING_USABLE } from '../../../features/artifacts/artifactScoutSection';
import { cancelCurrentTurn } from '../turn/cancelCurrentTurn';
import { claimTurnStart, resetTurnStartWindows } from '../turn/turnStartWindow';
import { advanceScoutTree } from '../workflows/scoutTree';
import { spawnReportAgent } from './spawnReportAgent';
import { spawnWireframeAgent } from './spawnWireframeAgent';
import {
  ARTIFACT_RUN_LOST_ATTACHMENTS_NOTE,
  artifactRunRestartSummary,
  expireArtifactScouts,
  joinArtifactScouts,
  recoverArtifactScouts,
  resetArtifactScoutRegistry,
  startReportScouts,
  startWireframeScouts,
  stopArtifactGeneration,
} from './artifactScoutRun';
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

const MOUNT = {
  mountId: 'mount-1' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-1' as ProjectId,
  mountName: 'goodboy',
  worktreePath: '/tmp/worktree',
  lastWorktreePath: null,
  repoRoot: '/tmp/repo',
  branch: 'ak/feat-x',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
} as unknown as SessionProjectMount;

const MOUNT_TWO = {
  mountId: 'mount-2' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-2' as ProjectId,
  mountName: 'goodboy-api',
  worktreePath: '/tmp/worktree-api',
  lastWorktreePath: null,
  repoRoot: '/tmp/repo-api',
  branch: 'ak/feat-y',
  baseBranch: 'main',
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 1,
} as unknown as SessionProjectMount;

const READY_PLAN = {
  plan: {
    kind: 'ready',
    roots: [
      {
        mountId: MOUNT.mountId,
        mountName: MOUNT.mountName,
        worktreePath: MOUNT.worktreePath,
        root: 'apps/web',
        rootReason: '"web" names this workspace',
      },
    ],
    scouts: WIREFRAME_SCOUTS,
    modelLabel: 'Claude Haiku 4.5',
  },
  gate: {
    kind: 'ready',
    mounts: [MOUNT],
    modelLabel: 'Claude Haiku 4.5',
  },
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
      kind: String(args['kindOverride'] ?? 'wireframe'),
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
    sessionProjectMounts: { [SESSION_ID]: [MOUNT, MOUNT_TWO] },
    sessionActiveMount: { [SESSION_ID]: MOUNT.mountId },
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
  state['startReportScouts'] = startReportScouts(set, get);
  state['joinArtifactScouts'] = joinArtifactScouts(set, get);
  state['expireArtifactScouts'] = expireArtifactScouts(set, get);
  state['recoverArtifactScouts'] = recoverArtifactScouts(set, get);
  state['stopArtifactGeneration'] = stopArtifactGeneration(set, get);
  state['advanceScoutTree'] = advanceScoutTree(set, get);
  state['spawnWireframeAgent'] = spawnWireframeAgent(get);
  state['spawnReportAgent'] = spawnReportAgent(get);
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
  provenanceRows.clear();
  resetArtifactScoutRegistry();
  resetTurnStartWindows();
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

describe('a scout cancelled before its turn has started', () => {
  const withRealCancel = (h: Harness): void => {
    h.state['cancelCurrentTurn'] = cancelCurrentTurn(h.set, h.get);
  };

  it('refuses the queued turn of a scout the user stopped', async () => {
    const h = harness();
    withRealCancel(h);
    const containerId = await spawn(h);
    await (h.state['stopArtifactGeneration'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
      agentId: containerId,
    });
    for (const scout of WIREFRAME_SCOUTS) {
      const child = childOf({ agents: h.agents, name: scout.name });
      expect(child.status).toBe('skipped');
      expect(claimTurnStart({ agentId: child.id })).toBe('cancelled');
    }
  });

  it('refuses the queued turn of a scout the deadline gave up on', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      withRealCancel(h);
      await spawn(h);
      await vi.advanceTimersByTimeAsync(WIREFRAME_SCOUT_DEADLINE_MS + 1);
      for (const scout of WIREFRAME_SCOUTS) {
        const child = childOf({ agents: h.agents, name: scout.name });
        expect(child.status).toBe('skipped');
        expect(claimTurnStart({ agentId: child.id })).toBe('cancelled');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a scout that is already running to the run cancellation', async () => {
    const h = harness();
    withRealCancel(h);
    const containerId = await spawn(h);
    const child = childOf({ agents: h.agents, name: 'screens and routes' });
    (h.state['agentTurnState'] as Record<string, unknown>)[child.id] = {
      kind: 'running',
      runId: 'run-1',
      startedAt: NOW,
    };
    await (h.state['stopArtifactGeneration'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
      agentId: containerId,
    });
    expect(claimTurnStart({ agentId: child.id })).toBe('granted');
  });
});

describe('recovering a container after a restart', () => {
  const recover = async (h: Harness): Promise<void> => {
    await (h.state['recoverArtifactScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
    });
  };

  const reportAll = (h: Harness): void => {
    for (const scout of WIREFRAME_SCOUTS) {
      const child = childOf({ agents: h.agents, name: scout.name });
      const index = h.agents.findIndex((agent) => agent.id === child.id);
      h.agents[index] = {
        ...child,
        status: 'completed',
        outputSummary: 'the batch list renders totals apps/web/src/Batches.tsx',
      } as Agent;
    }
    h.set(() => ({ sessionPhaseRuns: { [SESSION_ID]: [...h.agents] } }) as never);
  };

  it('settles the children and fails a container whose run was never recorded', async () => {
    const h = harness();
    const containerId = await spawn(h);
    resetArtifactScoutRegistry();
    provenanceRows.clear();
    await recover(h);
    for (const scout of WIREFRAME_SCOUTS) {
      const child = childOf({ agents: h.agents, name: scout.name });
      expect(child.status).toBe('skipped');
      expect(child.outputSummary).toBe(WIREFRAME_SCOUT_RESTART_REASON);
    }
    const container = h.agents.find((agent) => agent.id === containerId)!;
    expect(container.status).toBe('failed');
    expect(container.outputSummary).toBe(artifactRunRestartSummary({ kind: 'wireframe' }));
  });

  it('leaves a container this process is still waiting on alone', async () => {
    const h = harness();
    const containerId = await spawn(h);
    await recover(h);
    expect(h.agents.find((agent) => agent.id === containerId)!.status).toBe('running');
  });

  it('rejoins and produces when every scout reported before the reload', async () => {
    const h = harness();
    const containerId = await spawn(h);
    reportAll(h);
    resetArtifactScoutRegistry();
    h.sendTurn.mockClear();
    await recover(h);
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('## scout reports');
    expect(pack).toContain('the batch list renders totals');
    expect(h.agents.find((agent) => agent.id === containerId)!.status).not.toBe('failed');
  });

  it('joins once across the reload, whatever runs recovery again', async () => {
    const h = harness();
    const containerId = await spawn(h);
    reportAll(h);
    resetArtifactScoutRegistry();
    h.sendTurn.mockClear();
    await recover(h);
    resetArtifactScoutRegistry();
    await recover(h);
    await (h.state['joinArtifactScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
      containerId,
    });
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    expect(provenanceRows.get(containerId)?.['phase']).toBe('producing');
  });

  it('keeps the scout plan and the mount on the row it rewrites when it produces', async () => {
    const h = harness();
    const containerId = await spawn(h);
    reportAll(h);
    resetArtifactScoutRegistry();
    await recover(h);
    const row = provenanceRows.get(containerId)!;
    expect(row['phase']).toBe('producing');
    expect(row['deadlineAt']).toBeNull();
    expect(row['mountIds']).toEqual(['mount-1']);
    expect(row['target']).toBe('both');
    expect((row['scoutPlan'] as ReadonlyArray<Record<string, unknown>>).length).toBe(
      WIREFRAME_SCOUTS.length,
    );
  });

  it('says on the row that a recovered pack lost the attached files', async () => {
    const h = harness();
    const containerId = await spawn(h);
    reportAll(h);
    resetArtifactScoutRegistry();
    await recover(h);
    expect(provenanceRows.get(containerId)?.['omissions']).toContain(
      ARTIFACT_RUN_LOST_ATTACHMENTS_NOTE,
    );
  });

  it('says nothing about attachments on a run that never lost its context', async () => {
    const h = harness();
    const containerId = await spawn(h);
    await (
      h.state['advanceScoutTree'] as (
        sessionId: SessionId,
        agentId: AgentId,
        assistantText: string,
      ) => Promise<void>
    )(
      SESSION_ID,
      childOf({ agents: h.agents, name: 'screens and routes' }).id,
      'a apps/web/src/Batches.tsx',
    );
    await (
      h.state['advanceScoutTree'] as (
        sessionId: SessionId,
        agentId: AgentId,
        assistantText: string,
      ) => Promise<void>
    )(
      SESSION_ID,
      childOf({ agents: h.agents, name: 'data and contracts' }).id,
      'b apps/web/src/Batches.tsx',
    );
    expect(provenanceRows.get(containerId)?.['omissions']).not.toContain(
      ARTIFACT_RUN_LOST_ATTACHMENTS_NOTE,
    );
  });

  it('re-arms the clock instead of failing a run whose scouts are still out', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      const containerId = await spawn(h);
      resetArtifactScoutRegistry();
      h.sendTurn.mockClear();
      await recover(h);
      expect(h.agents.find((agent) => agent.id === containerId)!.status).not.toBe('failed');
      await vi.advanceTimersByTimeAsync(WIREFRAME_SCOUT_DEADLINE_MS + 1);
      const containerTurns = h.sendTurn.mock.calls.filter(
        (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
      );
      expect(containerTurns).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('report scouting', () => {
  const reportSpawn = async (
    h: Harness,
    reportType: 'change-summary' | 'session-summary',
    mountIds?: ReadonlyArray<MountId>,
  ): Promise<AgentId> => {
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
    return (h.state['spawnReportAgent'] as (args: Record<string, unknown>) => Promise<AgentId>)({
      sessionId: SESSION_ID,
      reportType,
      attachments: [],
      focus: 'none',
      ...(mountIds === undefined ? {} : { mountIds }),
    });
  };

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

  it('spawns one diff context scout for the mount the diff touched', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Batches.tsx'],
      additions: 2,
      deletions: 1,
    });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    expect(insertBatch).toHaveBeenCalledTimes(1);
    const inserted = insertBatch.mock.calls[0]![0] as {
      readonly children: ReadonlyArray<Record<string, unknown>>;
    };
    expect(inserted.children.map((child) => child['name'])).toEqual(['diff context']);
    const kickoff = String((h.sendTurn.mock.calls[0]![0] as Record<string, unknown>)['content']);
    expect(kickoff).toContain('apps/web/src/Batches.tsx');
    expect(kickoff).toContain('**Bound** one turn');
    const turns = h.sendTurn.mock.calls.map(
      (call) => (call[0] as Record<string, unknown>)['agentId'],
    );
    expect(turns).not.toContain(containerId);
  });

  it('spawns one diff context scout for every repository the diff touched', async () => {
    changedFiles.mockImplementation(async ({ worktreePath }) =>
      worktreePath === MOUNT.worktreePath
        ? { paths: ['apps/web/src/Batches.tsx'], additions: 2, deletions: 1 }
        : { paths: ['services/api/src/Totals.ts'], additions: 5, deletions: 0 },
    );
    const h = harness();
    await reportSpawn(h, 'change-summary', [MOUNT.mountId, MOUNT_TWO.mountId]);
    expect(insertBatch).toHaveBeenCalledTimes(1);
    const inserted = insertBatch.mock.calls[0]![0] as {
      readonly children: ReadonlyArray<Record<string, unknown>>;
    };
    expect(inserted.children).toHaveLength(2);
    const kickoffs = h.sendTurn.mock.calls.map((call) =>
      String((call[0] as Record<string, unknown>)['content']),
    );
    expect(kickoffs.join('\n')).toContain('services/api/src/Totals.ts');
  });

  it('spends no scout turn on a repository whose diff named no path', async () => {
    changedFiles.mockResolvedValue({ paths: [], additions: 0, deletions: 0 });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    expect(insertBatch).not.toHaveBeenCalled();
    const args = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(String(args['initialPrompt'])).toContain('evidence pack');
    expect(provenanceRows.get(containerId)?.['phase']).toBe('producing');
  });

  it('counts a path from the second repository as verified, never as an invention', async () => {
    changedFiles.mockImplementation(async ({ worktreePath }) =>
      worktreePath === MOUNT.worktreePath
        ? { paths: ['apps/web/src/Batches.tsx'], additions: 2, deletions: 1 }
        : { paths: ['services/api/src/Gone.ts'], additions: 0, deletions: 9 },
    );
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary', [MOUNT.mountId, MOUNT_TWO.mountId]);
    h.sendTurn.mockClear();
    const children = h.agents.filter((agent) => agent.parentAgentId === containerId);
    for (const child of children) {
      await (
        h.state['advanceScoutTree'] as (
          sessionId: SessionId,
          agentId: AgentId,
          assistantText: string,
        ) => Promise<void>
      )(SESSION_ID, child.id, 'the totals helper is gone services/api/src/Gone.ts');
    }
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('verified 1 of 1 cited paths');
    expect(pack).not.toContain('most of what it reported could not be found on disk');
  });

  it('writes the roster on the row before it starts a single scout', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Batches.tsx'],
      additions: 2,
      deletions: 1,
    });
    const h = harness();
    await reportSpawn(h, 'change-summary');
    const first = advanceRun.mock.calls[0]![0] as Record<string, unknown>;
    expect(advanceRun.mock.invocationCallOrder[0]!).toBeLessThan(
      insertBatch.mock.invocationCallOrder[0]!,
    );
    const plan = first['scoutPlan'] as ReadonlyArray<Record<string, unknown>>;
    expect(plan).toHaveLength(1);
    expect(plan[0]!['roleId']).toBe('diff-context');
  });

  it('rejoins the scouts of a roster whose agent ids were never written', async () => {
    changedFiles.mockImplementation(async ({ worktreePath }) =>
      worktreePath === MOUNT.worktreePath
        ? { paths: ['apps/web/src/Batches.tsx'], additions: 2, deletions: 1 }
        : { paths: ['services/api/src/Totals.ts'], additions: 5, deletions: 0 },
    );
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary', [MOUNT.mountId, MOUNT_TWO.mountId]);
    const row = provenanceRows.get(containerId)!;
    provenanceRows.set(containerId, {
      ...row,
      scoutPlan: (row['scoutPlan'] as ReadonlyArray<Record<string, unknown>>).map((entry) => ({
        ...entry,
        agentId: null,
      })),
    });
    for (const child of h.agents.filter((agent) => agent.parentAgentId === containerId)) {
      const index = h.agents.findIndex((agent) => agent.id === child.id);
      h.agents[index] = {
        ...child,
        status: 'completed',
        outputSummary: `${child.name} read it apps/web/src/Batches.tsx`,
      } as Agent;
    }
    h.set(() => ({ sessionPhaseRuns: { [SESSION_ID]: [...h.agents] } }) as never);
    resetArtifactScoutRegistry();
    h.sendTurn.mockClear();
    await (h.state['recoverArtifactScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
    });
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('diff context in goodboy read it');
    expect(pack).toContain('diff context in goodboy-api read it');
  });

  it('joins the diff context report into the pack it sends the container', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Batches.tsx'],
      additions: 2,
      deletions: 1,
    });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    h.sendTurn.mockClear();
    await settle(h, 'diff context', 'the totals helper moved apps/web/src/Batches.tsx');
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('evidence pack');
    expect(pack).toContain('## scout reports');
    expect(pack).toContain('the totals helper moved');
    expect(provenanceRows.get(containerId)?.['phase']).toBe('producing');
  });

  it('counts a path the diff deleted as verified, never as an invention', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Gone.tsx'],
      additions: 0,
      deletions: 9,
    });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    h.sendTurn.mockClear();
    await settle(h, 'diff context', 'the old totals helper is gone apps/web/src/Gone.tsx');
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('verified 1 of 1 cited paths');
    expect(pack).toContain('the old totals helper is gone');
    expect(pack).not.toContain('most of what it reported could not be found on disk');
  });

  it('tells a report whose scout came back empty that it is writing a report', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Batches.tsx'],
      additions: 2,
      deletions: 1,
    });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    h.sendTurn.mockClear();
    await (h.state['expireArtifactScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
      containerId,
    });
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain(REPORT_SCOUT_NOTHING_USABLE);
    expect(pack).not.toContain(WIREFRAME_SCOUT_NOTHING_USABLE);
    expect(pack).not.toContain('never a theme value');
  });

  it('produces a session summary immediately, with no scout at all', async () => {
    const h = harness();
    const containerId = await reportSpawn(h, 'session-summary');
    expect(insertBatch).not.toHaveBeenCalled();
    const args = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(String(args['initialPrompt'])).toContain('evidence pack');
    expect(provenanceRows.get(containerId)?.['phase']).toBe('producing');
  });

  it('rejoins a report run whose scout reported before the reload', async () => {
    changedFiles.mockResolvedValue({
      paths: ['apps/web/src/Batches.tsx'],
      additions: 2,
      deletions: 1,
    });
    const h = harness();
    const containerId = await reportSpawn(h, 'change-summary');
    const child = childOf({ agents: h.agents, name: 'diff context' });
    const index = h.agents.findIndex((agent) => agent.id === child.id);
    h.agents[index] = {
      ...child,
      status: 'completed',
      outputSummary: 'the totals helper moved apps/web/src/Batches.tsx',
    } as Agent;
    h.set(() => ({ sessionPhaseRuns: { [SESSION_ID]: [...h.agents] } }) as never);
    resetArtifactScoutRegistry();
    h.sendTurn.mockClear();
    await (h.state['recoverArtifactScouts'] as (args: Record<string, unknown>) => Promise<void>)({
      sessionId: SESSION_ID,
    });
    const containerTurns = h.sendTurn.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['agentId'] === containerId,
    );
    expect(containerTurns).toHaveLength(1);
    const pack = String((containerTurns[0]![0] as Record<string, unknown>)['content']);
    expect(pack).toContain('## scout reports');
    expect(pack).toContain('the totals helper moved');
    expect(h.agents.find((agent) => agent.id === containerId)!.status).not.toBe('failed');
  });
});
