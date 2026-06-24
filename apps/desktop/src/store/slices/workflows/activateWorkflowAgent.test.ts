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
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  addPlanConsumptionSpy,
  listConsumptionsForPlanSpy,
  listPlansForSessionSpy,
  fanOutClustersSpy,
} = vi.hoisted(() => ({
  addPlanConsumptionSpy: vi.fn(async () => undefined),
  listConsumptionsForPlanSpy: vi.fn(async () => []),
  listPlansForSessionSpy: vi.fn(async () => [] as ReadonlyArray<PlanWithCount>),
  fanOutClustersSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../features/plans/plans', () => ({
  addPlanConsumption: addPlanConsumptionSpy,
  listConsumptionsForPlan: listConsumptionsForPlanSpy,
  listPlansForSession: listPlansForSessionSpy,
}));

vi.mock('./clusterImplementation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./clusterImplementation')>();
  return { ...actual, fanOutClusters: fanOutClustersSpy };
});

import { activateWorkflowAgent } from './activateWorkflowAgent';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const SESSION_ID = 'ses-1' as SessionId;
const PLAN_ID = 'plan-1' as PlanId;
const AGENT_ID = 'agent-step' as AgentId;
const STEP_ID = 's-exec' as StepId;
const NOW = '2026-05-23T00:00:00.000Z' as IsoDateTime;

function makePlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: 'agent-planner' as AgentId,
    workflowRunId: RUN_ID,
    title: 'the plan',
    bodyMd: 'do the thing',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeWorkflow(stepName: string): Workflow {
  return {
    id: WF_ID,
    workspaceId: WS_ID,
    name: 'wf',
    description: '',
    steps: [
      { id: STEP_ID, workflowId: WF_ID, ordinal: 0, name: stepName, promptPrefix: 'run the step' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeAgent(kind: string | undefined, name: string): Agent {
  return {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    stepId: STEP_ID,
    workflowRunId: RUN_ID,
    ordinal: 0,
    name,
    status: 'pending',
    ...(kind !== undefined && { kind }),
  };
}

function buildHarness(opts: {
  agent: Agent;
  workflow: Workflow;
  plans: ReadonlyArray<PlanWithCount>;
}) {
  listPlansForSessionSpy.mockResolvedValue(opts.plans);
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
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: WF_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate' as const,
      },
    ],
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const sendTurn = vi.fn(
    async (_arg: { sessionId: SessionId; agentId: AgentId; content: string }) => undefined,
  );
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [opts.agent] },
    sessions: [session],
    phaseTemplates: { [WS_ID]: [opts.workflow] },
    sessionPlans: { [SESSION_ID]: opts.plans },
    planConsumptions: {},
    selectedAgentId: {},
    agentTurnState: {},
    sendTurn,
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof activateWorkflowAgent>[1];
  return {
    sendTurn,
    set,
    state,
    activate: activateWorkflowAgent(
      set as unknown as Parameters<typeof activateWorkflowAgent>[0],
      get,
    ),
  };
}

function mergedSetPartials(set: ReturnType<typeof vi.fn>, state: Record<string, unknown>) {
  return set.mock.calls.reduce((acc: Record<string, unknown>, call) => {
    const updater = call[0] as (s: Record<string, unknown>) => Record<string, unknown>;
    return { ...acc, ...updater({ ...state, ...acc }) };
  }, {});
}

describe('activateWorkflowAgent, plan consumption by kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsumptionsForPlanSpy.mockResolvedValue([]);
  });

  it('a generic step after a plan consumes it and receives the plan body', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID);

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toContain('do the thing');
    expect(payload.content).toContain('run the step');
    expect(fanOutClustersSpy).not.toHaveBeenCalled();
  });

  it('a reviewer step is passthrough: no consumption, no plan body injected', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('reviewer', 'Review'),
      workflow: makeWorkflow('Review'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID);

    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).not.toContain('do the thing');
    expect(payload.content).toBe('run the step');
  });

  it('an implementer step with multiple clusters still fans out (no regression)', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
    });

    await activate(SESSION_ID, AGENT_ID);

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-fan-out a consumed plan: a later step runs its own kickoff instead', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters, status: 'consumed' })],
    });

    await activate(SESSION_ID, AGENT_ID);

    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(fanOutClustersSpy).not.toHaveBeenCalled();
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toBe('run the step');
  });

  it('does not consume an already-consumed plan', async () => {
    const { activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ status: 'consumed' })],
    });

    await activate(SESSION_ID, AGENT_ID);

    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
  });

  it('injects and consumes an explicit plan, ignoring the latest active plan for the run', async () => {
    const EXPLICIT_ID = 'plan-explicit' as PlanId;
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [
        makePlan({ id: EXPLICIT_ID, bodyMd: 'explicit body' }),
        makePlan({ bodyMd: 'do the thing' }),
      ],
    });

    await activate(SESSION_ID, AGENT_ID, EXPLICIT_ID);

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(EXPLICIT_ID, AGENT_ID);
    expect(addPlanConsumptionSpy).not.toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toContain('explicit body');
    expect(payload.content).not.toContain('do the thing');
  });

  it('default call navigates: sets selectedAgentId for the session', async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID);

    const merged = mergedSetPartials(set, state);
    expect((merged.selectedAgentId as Record<string, unknown>)[SESSION_ID]).toBe(AGENT_ID);
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
  });

  it('navigate=false starts the step without setting selectedAgentId but still inits turn and sends', async () => {
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID, undefined, false);

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('replays an explicit plan even when it is already consumed', async () => {
    const { activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ status: 'consumed' })],
    });

    await activate(SESSION_ID, AGENT_ID, PLAN_ID);

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
  });

  it('navigate=false fans out a multi-cluster implementer without setting selectedAgentId', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { set, state, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
    });

    await activate(SESSION_ID, AGENT_ID, undefined, false);

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
  });

  it('navigate=false on a reviewer step sends the kickoff without navigating', async () => {
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('reviewer', 'Review'),
      workflow: makeWorkflow('Review'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID, undefined, false);

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn.mock.calls[0]![0].content).toBe('run the step');
  });

  it('navigate=false still injects and consumes an explicit plan', async () => {
    const EXPLICIT_ID = 'plan-explicit' as PlanId;
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ id: EXPLICIT_ID, bodyMd: 'explicit body' })],
    });

    await activate(SESSION_ID, AGENT_ID, EXPLICIT_ID, false);

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(EXPLICIT_ID, AGENT_ID);
    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect(sendTurn.mock.calls[0]![0].content).toContain('explicit body');
  });

  it('navigate=false never emits a selectedAgentId key, leaving prior selection intact', async () => {
    const { set, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID, undefined, false);

    const touchesSelection = set.mock.calls.some((call) => {
      const updater = call[0] as (s: Record<string, unknown>) => Record<string, unknown>;
      return 'selectedAgentId' in updater({ selectedAgentId: {} });
    });
    expect(touchesSelection).toBe(false);
  });

  it('explicit navigate=true behaves like the default and navigates', async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate(SESSION_ID, AGENT_ID, undefined, true);

    const merged = mergedSetPartials(set, state);
    expect((merged.selectedAgentId as Record<string, unknown>)[SESSION_ID]).toBe(AGENT_ID);
  });

  it('throws and never navigates or sends when the agent is missing', async () => {
    const { set, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await expect(activate(SESSION_ID, 'nope' as AgentId, undefined, false)).rejects.toThrow(
      'agent not found or not a workflow agent',
    );
    expect(set).not.toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
  });
});
