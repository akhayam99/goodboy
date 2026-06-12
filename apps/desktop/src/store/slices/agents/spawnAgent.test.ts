import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ImplementationCluster,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  invokeAgentInsertSpy,
  invokeAgentListSpy,
  addPlanConsumptionSpy,
  listConsumptionsForPlanSpy,
  listPlansForSessionSpy,
  fanOutClustersSpy,
} = vi.hoisted(() => ({
  invokeAgentInsertSpy: vi.fn(),
  invokeAgentListSpy: vi.fn(async () => [] as ReadonlyArray<Agent>),
  addPlanConsumptionSpy: vi.fn(async () => undefined),
  listConsumptionsForPlanSpy: vi.fn(async () => []),
  listPlansForSessionSpy: vi.fn(async () => [] as ReadonlyArray<PlanWithCount>),
  fanOutClustersSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
  invokeAgentList: invokeAgentListSpy,
}));

vi.mock('../../../features/plans/plans', () => ({
  addPlanConsumption: addPlanConsumptionSpy,
  listConsumptionsForPlan: listConsumptionsForPlanSpy,
  listPlansForSession: listPlansForSessionSpy,
}));

vi.mock('../workflows/clusterImplementation', () => ({ fanOutClusters: fanOutClustersSpy }));

import { spawnAgent } from './spawnAgent';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'ses-1' as SessionId;
const PLAN_ID = 'plan-1' as PlanId;
const INSERTED_ID = 'agent-new' as AgentId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

const TWO_CLUSTERS: ReadonlyArray<ImplementationCluster> = [
  { title: 'a', instructions: 'i1' },
  { title: 'b', instructions: 'i2' },
];

function makePlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: 'agent-planner' as AgentId,
    title: 'the plan',
    bodyMd: 'do the thing',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildHarness(plans: ReadonlyArray<PlanWithCount>) {
  listPlansForSessionSpy.mockResolvedValue(plans);
  invokeAgentInsertSpy.mockResolvedValue({
    id: INSERTED_ID,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    kind: 'implementer',
  } as Agent);
  invokeAgentListSpy.mockResolvedValue([]);

  const session: Session = {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'g',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic',
      allowTurnOverride: true,
    } as Session['providerPreference'],
    permissionMode: 'default' as Session['permissionMode'],
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const sendTurn = vi.fn(
    async (_arg: { sessionId: SessionId; agentId: AgentId; content: string }) => undefined,
  );
  const state = {
    sessions: [session],
    phaseTemplates: { [WS_ID]: [] },
    sessionPhaseRuns: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: plans },
    planConsumptions: {},
    selectedAgentId: {},
    agentTurnState: {},
    workspaceOverrides: {},
    transcripts: {},
    messages: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    agentKindOverride: {},
    sendTurn,
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof spawnAgent>[1];
  return {
    sendTurn,
    spawn: spawnAgent(set as unknown as Parameters<typeof spawnAgent>[0], get),
  };
}

describe('spawnAgent ad-hoc cluster fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsumptionsForPlanSpy.mockResolvedValue([]);
  });

  it('fans out an explicit (triggeredPlanId) plan with 2+ clusters', async () => {
    const { sendTurn, spawn } = buildHarness([makePlan({ clusters: TWO_CLUSTERS })]);

    await spawn(SESSION_ID, { triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, INSERTED_ID);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('fans out the latest active plan with 2+ clusters (no triggeredPlanId)', async () => {
    const { sendTurn, spawn } = buildHarness([makePlan({ clusters: TWO_CLUSTERS })]);

    await spawn(SESSION_ID, { kindOverride: 'implementer' });

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('does not fan out a single-cluster plan (kicks off the implementer directly)', async () => {
    const { sendTurn, spawn } = buildHarness([
      makePlan({ clusters: [{ title: 'only', instructions: 'i' }] }),
    ]);

    await spawn(SESSION_ID, { triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });

    expect(fanOutClustersSpy).not.toHaveBeenCalled();
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('fans out a plan with 2+ clusters even if status is not active', async () => {
    const { sendTurn, spawn } = buildHarness([
      makePlan({ clusters: TWO_CLUSTERS, status: 'done' }),
    ]);

    await spawn(SESSION_ID, { triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    expect(sendTurn).not.toHaveBeenCalled();
  });
});
