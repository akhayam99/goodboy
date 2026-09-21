import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ContextSlot,
  SessionArtifact,
  TurnEvent,
  ImplementationCluster,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
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
  resumeClusterChildrenSpy,
  listOpenQuestionsSpy,
  putArtifactProvenanceSpy,
} = vi.hoisted(() => ({
  putArtifactProvenanceSpy: vi.fn(async (_args: unknown) => undefined),
  addPlanConsumptionSpy: vi.fn(async () => undefined),
  listConsumptionsForPlanSpy: vi.fn(async () => []),
  listPlansForSessionSpy: vi.fn(async () => [] as ReadonlyArray<PlanWithCount>),
  fanOutClustersSpy: vi.fn(async () => undefined),
  resumeClusterChildrenSpy: vi.fn(async () => true),
  listOpenQuestionsSpy: vi.fn(async () => [] as ReadonlyArray<OpenQuestion>),
}));

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  putArtifactProvenance: putArtifactProvenanceSpy,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/plans/plans', () => ({
  addPlanConsumption: addPlanConsumptionSpy,
  listConsumptionsForPlan: listConsumptionsForPlanSpy,
  listPlansForSession: listPlansForSessionSpy,
}));

vi.mock('./clusterImplementation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./clusterImplementation')>();
  return {
    ...actual,
    fanOutClusters: fanOutClustersSpy,
    resumeClusterChildren: resumeClusterChildrenSpy,
  };
});

import { activateWorkflowAgent } from './activateWorkflowAgent';
import { WorkflowGateError } from './workflowActivationGate';
import { WORKFLOW_BLOCK_COPY } from '../../../features/workflows/blockCopy';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const SESSION_ID = 'ses-1' as SessionId;
const PLAN_ID = 'plan-1' as PlanId;
const AGENT_ID = 'agent-step' as AgentId;
const STEP_ID = 's-exec' as StepId;
const NOW = '2026-05-23T00:00:00.000Z' as IsoDateTime;

type SendTurnInput = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
  readonly origin?: 'workflow';
};

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
  autoRun?: boolean;
  extraAgents?: ReadonlyArray<Agent>;
  projects?: ReadonlyArray<Project>;
}) {
  listPlansForSessionSpy.mockResolvedValue(opts.plans);
  const handsFree = opts.autoRun ?? false;
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
        autoRun: handsFree,
        triggerMode: 'immediate' as const,
        executionMode: 'static' as const,
      },
    ],
    autoRun: handsFree,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const sendTurn = vi.fn(async (_arg: SendTurnInput) => undefined);
  const ensureProjectMounted = vi.fn(async () => undefined);
  const sessionSlots: Record<string, ReadonlyArray<ContextSlot>> = {};
  const state = {
    sessionSlots,
    ensureSessionSlots: async (sessionId: SessionId): Promise<ReadonlyArray<ContextSlot>> =>
      sessionSlots[sessionId] ?? [],
    sessionPhaseRuns: { [SESSION_ID]: [opts.agent, ...(opts.extraAgents ?? [])] },
    sessions: [session],
    projects: opts.projects ?? [],
    sessionProjectMounts: {},
    phaseTemplates: { [WS_ID]: [opts.workflow] },
    sessionPlans: { [SESSION_ID]: opts.plans },
    planConsumptions: {},
    selectedAgentId: {},
    agentTurnState: {},
    sendTurn,
    ensureProjectMounted,
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof activateWorkflowAgent>[1];
  return {
    sendTurn,
    ensureProjectMounted,
    sessionSlots,
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

const makeOpenQuestion = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  text: 'which database?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
  ...overrides,
});

describe('activateWorkflowAgent, open-question gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsumptionsForPlanSpy.mockResolvedValue([]);
    listOpenQuestionsSpy.mockResolvedValue([]);
  });

  it('refuses to start a pending step while its run has an unanswered question', async () => {
    listOpenQuestionsSpy.mockResolvedValue([makeOpenQuestion()]);
    const { set, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await expect(activate({ sessionId: SESSION_ID, agentId: AGENT_ID })).rejects.toThrow(
      WORKFLOW_BLOCK_COPY.questions,
    );
    expect(sendTurn).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('blocks the mobile bridge shape too: no caller-side gate, no bypass flag', async () => {
    listOpenQuestionsSpy.mockResolvedValue([makeOpenQuestion()]);
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    const error = await activate({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      focus: 'none',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkflowGateError);
    expect((error as WorkflowGateError).reason).toBe('questions');
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('lets the skip path through: bypassGate starts the step despite open questions', async () => {
    listOpenQuestionsSpy.mockResolvedValue([makeOpenQuestion()]);
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, bypassGate: true });

    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('ignores a question already answered and starts the step', async () => {
    listOpenQuestionsSpy.mockResolvedValue([]);
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sendTurn).toHaveBeenCalledTimes(1);
  });
});

describe('activateWorkflowAgent, plan consumption by kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsumptionsForPlanSpy.mockResolvedValue([]);
    listOpenQuestionsSpy.mockResolvedValue([]);
  });

  it('a generic step after a plan consumes it and receives the plan body', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toContain('do the thing');
    expect(payload.content).toContain('run the step');
    expect(fanOutClustersSpy).not.toHaveBeenCalled();
  });

  it('does not mount projects merely mentioned by a writing workflow step', async () => {
    const projects = ['api', 'data', 'app-web'].map(
      (name, index) =>
        ({
          id: `project-${index}` as ProjectId,
          workspaceId: WS_ID,
          name,
          rootPath: `/tmp/${name}`,
          kind: 'repo',
        }) as Project,
    );
    const { activate, ensureProjectMounted } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ bodyMd: 'Read api and data, then edit app-web.' })],
      projects,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(ensureProjectMounted).not.toHaveBeenCalled();
  });

  it('awaits the workflow kickoff and identifies its origin', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });
    sendTurn.mockRejectedValueOnce(new Error('kickoff failed'));

    await expect(activate({ sessionId: SESSION_ID, agentId: AGENT_ID })).rejects.toThrow(
      'kickoff failed',
    );
    expect(sendTurn).toHaveBeenCalledWith(expect.objectContaining({ origin: 'workflow' }));
  });

  it('a reviewer step is passthrough: no consumption, no plan body injected', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('reviewer', 'Review'),
      workflow: makeWorkflow('Review'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).not.toContain('do the thing');
    expect(payload.content).toContain('run the step');
    expect(payload.content).toContain('<<step-done');
  });

  it('an implementer step with multiple clusters fans out', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
      autoRun: true,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
  });

  it('cluster children cannot recursively materialize a cluster plan', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const child: Agent = {
      ...makeAgent('implementer', 'Implement'),
      parentAgentId: 'container-1' as AgentId,
    };
    const { activate } = buildHarness({
      agent: child,
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
      autoRun: true,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(fanOutClustersSpy).not.toHaveBeenCalled();
  });

  it('both container entry paths use the same routing decision contract', async () => {
    const routingProposal = {
      pick: { provider: 'anthropic', model: 'haiku-4.5', effort: 'low' },
      reason: 'a mechanical edit',
      source: 'agent',
      profile: { taskType: 'implementation', difficulty: 'light', basis: 'agent' },
    } satisfies NonNullable<ImplementationCluster['routingProposal']>;
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1', routingProposal },
      { title: 'b', instructions: 'i2' },
    ];
    const { activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
      autoRun: true,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    const call = fanOutClustersSpy.mock.calls[0] as unknown as ReadonlyArray<unknown>;
    const container = call[3] as Agent;
    const passed = call[4] as ReadonlyArray<ImplementationCluster>;
    expect(container.parentAgentId).toBeUndefined();
    expect(passed[0]?.routingProposal).toEqual(routingProposal);
    expect(passed[1]?.routingProposal).toBeUndefined();
  });

  it('an implementer step with multiple clusters fans out even when hands-free is off', async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
      autoRun: false,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

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

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(fanOutClustersSpy).not.toHaveBeenCalled();
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toContain('run the step');
    expect(payload.content).toContain('<<step-done');
  });

  it('does not consume an already-consumed plan', async () => {
    const { activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ status: 'consumed' })],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

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

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, explicitPlanId: EXPLICIT_ID });

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(EXPLICIT_ID, AGENT_ID);
    expect(addPlanConsumptionSpy).not.toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    const [payload] = sendTurn.mock.calls[0]!;
    expect(payload.content).toContain('explicit body');
    expect(payload.content).not.toContain('do the thing');
  });

  it('default call stays put: starts the step without selecting its agent', async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
  });

  it('leaves the selection alone while the operator is watching the workflows lens', async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });
    Object.assign(state, { activeLens: { [SESSION_ID]: 'workflows' } });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'agent' });

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
  });

  it('still navigates when the operator is reading a step chat', async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });
    Object.assign(state, {
      activeLens: { [SESSION_ID]: 'workflows' },
      selectedAgentId: { [SESSION_ID]: 'other-agent' },
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'agent' });

    const merged = mergedSetPartials(set, state);
    expect((merged.selectedAgentId as Record<string, unknown>)[SESSION_ID]).toBe(AGENT_ID);
  });

  it("focus 'none' starts the step without setting selectedAgentId but still inits turn and sends", async () => {
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'none' });

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it("focus 'announce' fires the follow event and never touches the selection", async () => {
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });
    const seen: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => {
      seen.push((event as CustomEvent).detail as Record<string, unknown>);
    };
    window.addEventListener('goodboy:workflow-step-started', listener);

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'announce' });
    window.removeEventListener('goodboy:workflow-step-started', listener);

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      stepName: 'Execute commits',
    });
  });

  it('replays an explicit plan even when it is already consumed', async () => {
    const { activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ status: 'consumed' })],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, explicitPlanId: PLAN_ID });

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
  });

  it("focus 'none' fans out a multi-cluster implementer without setting selectedAgentId", async () => {
    const clusters: ReadonlyArray<ImplementationCluster> = [
      { title: 'a', instructions: 'i1' },
      { title: 'b', instructions: 'i2' },
    ];
    const { set, state, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ clusters })],
      autoRun: true,
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'none' });

    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect((merged.agentTurnState as Record<string, unknown>)[AGENT_ID]).toBeDefined();
  });

  it("focus 'none' on a reviewer step sends the kickoff without navigating", async () => {
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('reviewer', 'Review'),
      workflow: makeWorkflow('Review'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'none' });

    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn.mock.calls[0]![0].content).toContain('run the step');
    expect(sendTurn.mock.calls[0]![0].content).toContain('<<step-done');
  });

  it("focus 'none' still injects and consumes an explicit plan", async () => {
    const EXPLICIT_ID = 'plan-explicit' as PlanId;
    const { set, state, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan({ id: EXPLICIT_ID, bodyMd: 'explicit body' })],
    });

    await activate({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      explicitPlanId: EXPLICIT_ID,
      focus: 'none',
    });

    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(EXPLICIT_ID, AGENT_ID);
    const merged = mergedSetPartials(set, state);
    expect(merged.selectedAgentId).toBeUndefined();
    expect(sendTurn.mock.calls[0]![0].content).toContain('explicit body');
  });

  it("focus 'none' never emits a selectedAgentId key, leaving prior selection intact", async () => {
    const { set, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'none' });

    const touchesSelection = set.mock.calls.some((call) => {
      const updater = call[0] as (s: Record<string, unknown>) => Record<string, unknown>;
      return 'selectedAgentId' in updater({ selectedAgentId: {} });
    });
    expect(touchesSelection).toBe(false);
  });

  it("explicit focus 'agent' navigates to the step chat", async () => {
    const { set, state, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID, focus: 'agent' });

    const merged = mergedSetPartials(set, state);
    expect((merged.selectedAgentId as Record<string, unknown>)[SESSION_ID]).toBe(AGENT_ID);
  });

  it('throws and never navigates or sends when the agent is missing', async () => {
    const { set, sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute commits'),
      workflow: makeWorkflow('Execute commits'),
      plans: [makePlan()],
    });

    await expect(
      activate({ sessionId: SESSION_ID, agentId: 'nope' as AgentId, focus: 'none' }),
    ).rejects.toThrow('agent not found or not a workflow agent');
    expect(set).not.toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
  });
});

describe('activateWorkflowAgent, cluster container re-activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsumptionsForPlanSpy.mockResolvedValue([]);
    listOpenQuestionsSpy.mockResolvedValue([]);
    resumeClusterChildrenSpy.mockResolvedValue(true);
  });

  const clusterChild = (over: Partial<Agent>): Agent => ({
    id: 'child-1' as AgentId,
    sessionId: SESSION_ID,
    workflowRunId: RUN_ID,
    parentAgentId: AGENT_ID,
    ordinal: 1,
    name: 'cluster 1',
    status: 'pending',
    ...over,
  });

  it('resumes the cluster instead of running the container as a plain step', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ status: 'consumed' })],
      extraAgents: [clusterChild({})],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(resumeClusterChildrenSpy).toHaveBeenCalledTimes(1);
    expect(sendTurn).not.toHaveBeenCalled();
    expect(fanOutClustersSpy).not.toHaveBeenCalled();
  });

  it('runs the step normally once every cluster child has settled', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('implementer', 'Implement'),
      workflow: makeWorkflow('Implement'),
      plans: [makePlan({ status: 'consumed' })],
      extraAgents: [clusterChild({ status: 'completed' })],
    });

    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(resumeClusterChildrenSpy).not.toHaveBeenCalled();
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });
});

type EvidenceArtifactParams = Readonly<{ workflowRunId: WorkflowRunId | null }>;

const evidenceArtifact = ({ workflowRunId }: EvidenceArtifactParams): SessionArtifact => ({
  id: `artifact-${workflowRunId ?? 'session'}` as ArtifactId,
  sessionId: SESSION_ID,
  agentId: 'earlier-agent' as AgentId,
  workflowRunId,
  kind: 'plan',
  schemaVersion: 1,
  title: workflowRunId === RUN_ID ? 'run plan' : 'session plan',
  sourceFormat: 'markdown',
  sourceText: workflowRunId === RUN_ID ? 'scoped plan evidence' : 'session plan evidence',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

describe('activateWorkflowAgent, artifact evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOpenQuestionsSpy.mockResolvedValue([]);
  });

  it.each(['report', 'wireframe'])(
    'gives a %s step evidence from its run and records its executing run',
    async (kind) => {
      const earlier = { ...makeAgent('scout', 'in-run scout'), id: 'earlier-agent' as AgentId };
      const unrelated = {
        ...makeAgent('scout', 'unrelated scout'),
        id: 'other-agent' as AgentId,
        workflowRunId: 'other-run' as WorkflowRunId,
      };
      const { state, sendTurn, activate } = buildHarness({
        agent: makeAgent(kind, kind),
        workflow: makeWorkflow(kind),
        plans: [],
        extraAgents: [earlier, unrelated],
      });
      Object.assign(state, {
        transcripts: {
          [earlier.id]: [
            {
              kind: 'assistant_text',
              runId: 'turn-1' as TurnEvent['runId'],
              at: NOW,
              delta: 'the run discovered a session inbox',
            },
          ],
          [unrelated.id]: [
            {
              kind: 'assistant_text',
              runId: 'turn-2' as TurnEvent['runId'],
              at: NOW,
              delta: 'unrelated output',
            },
          ],
        } satisfies Record<string, ReadonlyArray<TurnEvent>>,
        sessionArtifacts: {
          [SESSION_ID]: [
            evidenceArtifact({ workflowRunId: RUN_ID }),
            evidenceArtifact({ workflowRunId: null }),
          ],
        },
      });
      await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
      const prompt = sendTurn.mock.calls[0]?.[0].content;
      expect(prompt).toContain('the run discovered a session inbox');
      expect(prompt).not.toContain('unrelated output');
      expect(prompt).toContain('scoped plan evidence');
      expect(prompt).toContain('<<step-done id="agent-step">>');
      expect(putArtifactProvenanceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            agentId: AGENT_ID,
            kind,
            sourceWorkflowRunId: RUN_ID,
            executingWorkflowRunId: RUN_ID,
            evidence: expect.arrayContaining([
              { kind: 'agent', id: earlier.id, label: earlier.name },
            ]),
          }),
        }),
      );
    },
  );

  it('keeps report artifacts run scoped and retains the workflow goal and brief', async () => {
    const workflow = { ...makeWorkflow('Report'), goal: 'explain the release' };
    const { state, sendTurn, activate } = buildHarness({
      agent: makeAgent('report', 'Report'),
      workflow,
      plans: [],
    });
    Object.assign(state, {
      sessionArtifacts: {
        [SESSION_ID]: [
          evidenceArtifact({ workflowRunId: RUN_ID }),
          evidenceArtifact({ workflowRunId: null }),
        ],
      },
    });
    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
    const prompt = sendTurn.mock.calls[0]?.[0].content;
    expect(prompt).toContain('# evidence pack: Session summary');
    expect(prompt).toContain('**Goal** explain the release');
    expect(prompt).toContain('# user request\n\nrun the step');
    expect(prompt).not.toContain('session plan evidence');
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
  });

  it.each(['report', 'wireframe'])(
    'carries the goal the user wrote into the %s kickoff pack',
    async (kind) => {
      const longGoal = [
        'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
        'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
      ].join('\n\n');
      const { sessionSlots, sendTurn, activate } = buildHarness({
        agent: makeAgent(kind, kind),
        workflow: makeWorkflow(kind),
        plans: [],
      });
      sessionSlots[SESSION_ID] = [{ key: 'goal', value: longGoal, enabled: true }];
      await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
      expect(sendTurn.mock.calls[0]?.[0].content).toContain(`## goal\n\n${longGoal}`);
    },
  );

  it.each(['report', 'wireframe'])(
    'leaves the %s kickoff pack without a goal block when no slot says more',
    async (kind) => {
      const { sendTurn, activate } = buildHarness({
        agent: makeAgent(kind, kind),
        workflow: makeWorkflow(kind),
        plans: [],
      });
      await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
      expect(sendTurn.mock.calls[0]?.[0].content).not.toContain('## goal');
    },
  );

  it('keeps session plans and the document contract for a run scoped wireframe', async () => {
    const { state, sendTurn, activate } = buildHarness({
      agent: makeAgent('wireframe', 'Wireframe'),
      workflow: makeWorkflow('Wireframe'),
      plans: [],
    });
    Object.assign(state, {
      sessionArtifacts: { [SESSION_ID]: [evidenceArtifact({ workflowRunId: null })] },
    });
    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
    const prompt = sendTurn.mock.calls[0]?.[0].content;
    expect(prompt).toContain('session plan evidence');
    expect(prompt).toContain('# low fidelity wireframe request');
    expect(prompt).toContain('## document contract');
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
  });

  it.each(['report', 'wireframe'])(
    'falls back to session evidence when a %s step has no run',
    async (kind) => {
      const agent = { ...makeAgent(kind, kind), workflowRunId: undefined };
      const scout = {
        ...makeAgent('scout', 'session scout'),
        id: 'scout-1' as AgentId,
        status: 'completed' as const,
      };
      const { state, sendTurn, activate } = buildHarness({
        agent,
        workflow: makeWorkflow(kind),
        plans: [],
        extraAgents: [scout],
      });
      Object.assign(state, {
        sessionArtifacts: { [SESSION_ID]: [evidenceArtifact({ workflowRunId: null })] },
      });
      await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
      expect(sendTurn.mock.calls[0]?.[0].content).toContain('session scout');
      expect(sendTurn.mock.calls[0]?.[0].content).toContain('session plan evidence');
      expect(putArtifactProvenanceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            sourceWorkflowRunId: null,
            executingWorkflowRunId: null,
          }),
        }),
      );
    },
  );

  it.each(['report', 'wireframe'])(
    'keeps the executing %s step out of its own pack and provenance',
    async (kind) => {
      const earlier = {
        ...makeAgent('scout', 'in-run scout'),
        id: 'earlier-agent' as AgentId,
        status: 'completed' as const,
      };
      const later = {
        ...makeAgent('reviewer', 'later reviewer'),
        id: 'later-agent' as AgentId,
        ordinal: 2,
      };
      const { state, sendTurn, activate } = buildHarness({
        agent: makeAgent(kind, kind),
        workflow: makeWorkflow(kind),
        plans: [],
        extraAgents: [earlier, later],
      });
      Object.assign(state, {
        transcripts: {
          [earlier.id]: [
            {
              kind: 'assistant_text',
              runId: 'turn-1' as TurnEvent['runId'],
              at: NOW,
              delta: 'the run discovered a session inbox',
            },
          ],
          [AGENT_ID]: [
            {
              kind: 'assistant_text',
              runId: 'turn-9' as TurnEvent['runId'],
              at: NOW,
              delta: 'a discarded first attempt at this artifact',
            },
          ],
        } satisfies Record<string, ReadonlyArray<TurnEvent>>,
      });
      await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
      const prompt = sendTurn.mock.calls[0]?.[0].content;
      expect(prompt).toContain('the run discovered a session inbox');
      expect(prompt).not.toContain('a discarded first attempt at this artifact');
      expect(prompt).not.toContain('no assistant output recorded');
      expect(prompt).not.toContain('no final message was recorded');
      expect(prompt).not.toContain('later reviewer');
      const recorded = putArtifactProvenanceSpy.mock.calls[0]?.[0] as {
        readonly input: { readonly evidence: ReadonlyArray<{ readonly id: string }> };
      };
      const evidenceIds = recorded.input.evidence.map((entry) => entry.id);
      expect(evidenceIds).toContain(earlier.id);
      expect(evidenceIds).not.toContain(AGENT_ID);
      expect(evidenceIds).not.toContain(later.id);
    },
  );

  it('collects a mounted diff instead of treating the step prefix as supplied evidence', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ paths: ['src/inbox.ts'], additions: 8, deletions: 2, numstat: '' })
      .mockResolvedValueOnce([
        {
          sha: 'abc1234',
          shortSha: 'abc1234',
          subject: 'add inbox',
          author: 'dev',
          timestamp: 0,
          pushed: false,
          parentSha: null,
        },
      ]);
    const { state, sendTurn, activate } = buildHarness({
      agent: makeAgent('report', 'Report'),
      workflow: makeWorkflow('Report'),
      plans: [],
    });
    Object.assign(state, {
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            mountId: 'mount-1',
            mountName: 'app',
            worktreePath: '/tmp/worktree',
            baseBranch: 'main',
          },
        ],
      },
    });
    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
    const prompt = sendTurn.mock.calls[0]?.[0].content;
    expect(prompt).toContain('abc1234 add inbox');
    expect(prompt).toContain('+8 -2');
    expect(prompt).toContain('src/inbox.ts');
  });

  it('still starts the step if provenance storage fails', async () => {
    putArtifactProvenanceSpy.mockRejectedValueOnce(new Error('database is locked'));
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('report', 'Report'),
      workflow: makeWorkflow('Report'),
      plans: [],
    });
    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn.mock.calls[0]?.[0].content).toContain('# evidence pack');
  });

  it('leaves the plan-consuming kickoff unchanged', async () => {
    const { sendTurn, activate } = buildHarness({
      agent: makeAgent('generic', 'Execute'),
      workflow: makeWorkflow('Execute'),
      plans: [makePlan()],
    });
    await activate({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(sendTurn.mock.calls[0]?.[0].content).toBe(
      '**Plan**\ndo the thing\n\nrun the step\n\n**Scope** this step only, never a later one. Emit `<<step-done id="agent-step">>` on its own line once it is truly done.',
    );
    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(PLAN_ID, AGENT_ID);
    expect(putArtifactProvenanceSpy).not.toHaveBeenCalled();
  });
});
