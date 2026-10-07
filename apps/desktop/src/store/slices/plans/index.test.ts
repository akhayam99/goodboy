// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionArtifact,
  SessionId,
  StepId,
  TurnState,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { exec: vi.fn(), execute: vi.fn(), select: vi.fn() },
}));

import { aStoredPlan } from '../../../test/planFixtures';
import { createPlansSlice } from './index';
import { WorkflowGateError } from '../workflows/workflowActivationGate';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-refactor' as WorkflowId;
const RUN_ID = 'run-refactor' as WorkflowRunId;
const SESSION_ID = 'ses-1' as SessionId;
const PLAN_ID = 'plan-1' as PlanId;
const CREATOR_AGENT_ID = 'agent-planner' as AgentId;
const IMPL_AGENT_ID = 'agent-impl' as AgentId;
const STEP_PLAN = 's-plan' as StepId;
const STEP_IMPL = 's-impl' as StepId;
const STEP_REVIEW = 's-review' as StepId;
const NOW = '2026-05-23T00:00:00.000Z' as IsoDateTime;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
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
        executionMode: 'static' as const,
      },
    ],
    autoRun: false,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: CREATOR_AGENT_ID,
    title: 't',
    bodyMd: 'b',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent',
    status: 'pending',
    ...overrides,
  };
}

function makeWorkflow(
  steps: ReadonlyArray<{ id: StepId; name: string; ordinal: number }>,
): Workflow {
  return {
    id: WF_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: '',
    steps: steps.map((s) => ({
      id: s.id,
      workflowId: WF_ID,
      ordinal: s.ordinal,
      name: s.name,
      promptPrefix: '',
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

type FakeState = {
  sessions: ReadonlyArray<Session>;
  sessionPlans: Record<SessionId, ReadonlyArray<PlanWithCount>>;
  sessionPhaseRuns: Record<SessionId, ReadonlyArray<Agent>>;
  sessionArtifacts: Record<SessionId, ReadonlyArray<SessionArtifact>>;
  agentTurnState: Record<AgentId, TurnState>;
  phaseTemplates: Record<WorkspaceId, ReadonlyArray<Workflow>>;
  spawnAgent: ReturnType<typeof vi.fn>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
};

function buildSlice(state: FakeState) {
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof createPlansSlice>[0]['get'];
  return createPlansSlice({
    set: set as unknown as Parameters<typeof createPlansSlice>[0]['set'],
    get,
  });
}

function defaultState(overrides: Partial<FakeState> = {}): FakeState {
  const session = makeSession();
  const plan = makePlan();
  const creator: Agent = makeAgent({
    id: CREATOR_AGENT_ID,
    stepId: STEP_PLAN,
    workflowRunId: RUN_ID,
    status: 'completed',
    name: 'Plan',
    ordinal: 0,
  });
  const nextImpl: Agent = makeAgent({
    id: IMPL_AGENT_ID,
    stepId: STEP_IMPL,
    workflowRunId: RUN_ID,
    status: 'pending',
    name: 'Refactor',
    ordinal: 1,
  });
  const wf = makeWorkflow([
    { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
    { id: STEP_IMPL, name: 'Refactor', ordinal: 1 },
  ]);
  return {
    sessions: [session],
    sessionPlans: { [SESSION_ID]: [plan] },
    sessionPhaseRuns: { [SESSION_ID]: [creator, nextImpl] },
    sessionArtifacts: {
      [SESSION_ID]: [
        aStoredPlan({ id: PLAN_ID, sessionId: SESSION_ID, agentId: CREATOR_AGENT_ID }, plan),
      ],
    },
    agentTurnState: {},
    phaseTemplates: { [WS_ID]: [wf] },
    spawnAgent: vi.fn(async () => 'spawned' as AgentId),
    activateWorkflowAgent: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('runPlan, workflow-aware spawn routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('in-workflow activation (all gates pass)', () => {
    it('activates the pre-created pending step agent, routing the clicked plan, with no spawn', async () => {
      const state = defaultState();
      const slice = buildSlice(state);

      const result = await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({ kind: 'started', agentId: IMPL_AGENT_ID, scope: 'workflow' });
      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(state.activateWorkflowAgent).toHaveBeenCalledTimes(1);
      expect(state.activateWorkflowAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        agentId: IMPL_AGENT_ID,
        explicitPlanId: PLAN_ID,
        focus: 'none',
      });
    });

    it('does not insert a duplicate agent for a step that already has a pending slot', async () => {
      const state = defaultState();
      const before = state.sessionPhaseRuns[SESSION_ID]!.length;
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.sessionPhaseRuns[SESSION_ID]).toHaveLength(before);
      expect(state.spawnAgent).not.toHaveBeenCalled();
    });

    it('recognizes implementer aliases ("Implement", "Build", "Refactor", "Code", "Feature", "Develop")', async () => {
      const aliases = ['Implement', 'Build', 'Refactor', 'Code', 'Feature', 'Develop'];
      for (const name of aliases) {
        const state = defaultState({
          phaseTemplates: {
            [WS_ID]: [
              makeWorkflow([
                { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
                { id: STEP_IMPL, name, ordinal: 1 },
              ]),
            ],
          },
        });
        const slice = buildSlice(state);

        await slice.runPlan(SESSION_ID, PLAN_ID);

        expect(state.spawnAgent, `alias "${name}" must not free-spawn`).not.toHaveBeenCalled();
        expect(
          state.activateWorkflowAgent,
          `alias "${name}" should activate the slot`,
        ).toHaveBeenCalledWith({
          sessionId: SESSION_ID,
          agentId: IMPL_AGENT_ID,
          explicitPlanId: PLAN_ID,
          focus: 'none',
        });
      }
    });

    it.each([['Debug'], ['Execute commits']])(
      'activates the workflow slot for %s (consuming kind)',
      async (name) => {
        const state = defaultState({
          phaseTemplates: {
            [WS_ID]: [
              makeWorkflow([
                { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
                { id: STEP_IMPL, name, ordinal: 1 },
              ]),
            ],
          },
        });
        const slice = buildSlice(state);

        await slice.runPlan(SESSION_ID, PLAN_ID);

        expect(state.spawnAgent).not.toHaveBeenCalled();
        expect(state.activateWorkflowAgent).toHaveBeenCalledWith({
          sessionId: SESSION_ID,
          agentId: IMPL_AGENT_ID,
          explicitPlanId: PLAN_ID,
          focus: 'none',
        });
      },
    );
  });

  describe('workflow gate rejects the activation (open questions block the run)', () => {
    it('notifies instead of throwing, refuses without a second message, and does not free-spawn', async () => {
      const state = defaultState({
        activateWorkflowAgent: vi.fn(async () => {
          throw new WorkflowGateError({ reason: 'questions' });
        }),
      });
      const slice = buildSlice(state);

      await expect(slice.runPlan(SESSION_ID, PLAN_ID)).resolves.toEqual({
        kind: 'refused',
        reason: null,
        workflowRunId: RUN_ID,
      });

      expect(state.activateWorkflowAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        agentId: IMPL_AGENT_ID,
        explicitPlanId: PLAN_ID,
        focus: 'none',
      });
      expect(state.emitNotification).toHaveBeenCalledTimes(1);
      expect(state.emitNotification.mock.calls[0]![0].title).toBe('Run step held back');
      expect(state.spawnAgent).not.toHaveBeenCalled();
    });
  });

  describe('gate A, session has no workflows attached → free-spawn', () => {
    it('free-spawns an implementer when session has no workflow attached', async () => {
      const state = defaultState({
        sessions: [makeSession({ workflowRuns: [] })],
      });
      const slice = buildSlice(state);

      const result = await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({ kind: 'started', agentId: 'spawned', scope: 'session' });
      expect(state.spawnAgent).toHaveBeenCalledTimes(1);
      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
        focus: 'none',
      });
      expect(args).not.toHaveProperty('stepId');
    });

    it('free-spawns when the session id does not match any session in the store', async () => {
      const state = defaultState({ sessions: [] });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
        focus: 'none',
      });
    });
  });

  describe('gate B, plan creator agent has no stepId → free-spawn', () => {
    it('free-spawns when the creator agent is not part of the workflow (no stepId)', async () => {
      const freeCreator: Agent = makeAgent({
        id: CREATOR_AGENT_ID,
        status: 'completed',
        name: 'free planner',
        ordinal: 0,
      });
      const state = defaultState({
        sessionPhaseRuns: {
          [SESSION_ID]: [
            freeCreator,
            makeAgent({
              id: IMPL_AGENT_ID,
              stepId: STEP_IMPL,
              status: 'pending',
              name: 'Refactor',
              ordinal: 1,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
        focus: 'none',
      });
    });

    it('free-spawns when the plan itself is missing (stale planId)', async () => {
      const state = defaultState({
        sessionPlans: { [SESSION_ID]: [] },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
        focus: 'none',
      });
    });

    it("free-spawns when the plan's creator agent is not in sessionPhaseRuns", async () => {
      const state = defaultState({
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: IMPL_AGENT_ID,
              stepId: STEP_IMPL,
              status: 'pending',
              name: 'Refactor',
              ordinal: 1,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
        focus: 'none',
      });
    });
  });

  describe('gate C, the workflow run is gone → starts outside the workflow and says so', () => {
    const FREE_SPAWN = {
      triggeredPlanId: PLAN_ID,
      kindOverride: 'implementer',
      focus: 'none',
    };

    it('starts outside when the run the plan came from was discarded', async () => {
      const discarded = makeSession().workflowRuns[0]!;
      const state = defaultState({
        sessions: [makeSession({ workflowRuns: [{ ...discarded, discardedAt: NOW }] })],
      });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({
        kind: 'startedOutside',
        agentId: 'spawned',
        note: 'Started outside the run, it was discarded',
      });
      expect(state.spawnAgent.mock.calls[0]![1]).toEqual(FREE_SPAWN);
      expect(state.activateWorkflowAgent).not.toHaveBeenCalled();
    });

    it.each([
      ['the template is missing from phaseTemplates', { [WS_ID]: [] }],
      ['the workspace has no phaseTemplates entry at all', {}],
    ])('starts outside when %s', async (_name, phaseTemplates) => {
      const state = defaultState({ phaseTemplates });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({
        kind: 'startedOutside',
        agentId: 'spawned',
        note: 'Started outside the run, its workflow is no longer available',
      });
      expect(state.spawnAgent.mock.calls[0]![1]).toEqual(FREE_SPAWN);
    });
  });

  describe('a live workflow that cannot take the plan → refuses with the reason and the run', () => {
    const expectRefused = async ({
      state,
      reason,
    }: {
      readonly state: FakeState;
      readonly reason: string;
    }) => {
      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({ kind: 'refused', reason, workflowRunId: RUN_ID });
      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(state.activateWorkflowAgent).not.toHaveBeenCalled();
    };

    it('has no step left when every step is completed', async () => {
      await expectRefused({
        reason: 'The run has no step left for this plan',
        state: defaultState({
          sessionPhaseRuns: {
            [SESSION_ID]: [
              makeAgent({
                id: CREATOR_AGENT_ID,
                stepId: STEP_PLAN,
                workflowRunId: RUN_ID,
                status: 'completed',
                name: 'Plan',
                ordinal: 0,
              }),
              makeAgent({
                id: IMPL_AGENT_ID,
                stepId: STEP_IMPL,
                workflowRunId: RUN_ID,
                status: 'completed',
                name: 'Refactor',
                ordinal: 1,
              }),
            ],
          },
        }),
      });
    });

    it('names the earlier step that is not done yet', async () => {
      const earlyStep = 's-scout' as StepId;
      const wf = makeWorkflow([
        { id: earlyStep, name: 'Scout', ordinal: 0 },
        { id: STEP_PLAN, name: 'Plan', ordinal: 1 },
        { id: STEP_IMPL, name: 'Refactor', ordinal: 2 },
      ]);
      await expectRefused({
        reason: 'The next step (Scout) does not run plans',
        state: defaultState({
          phaseTemplates: { [WS_ID]: [wf] },
          sessionPhaseRuns: {
            [SESSION_ID]: [
              makeAgent({
                id: 'agent-scout' as AgentId,
                stepId: earlyStep,
                workflowRunId: RUN_ID,
                status: 'pending',
                name: 'Scout',
                ordinal: 0,
              }),
              makeAgent({
                id: CREATOR_AGENT_ID,
                stepId: STEP_PLAN,
                workflowRunId: RUN_ID,
                status: 'completed',
                name: 'Plan',
                ordinal: 1,
              }),
              makeAgent({
                id: IMPL_AGENT_ID,
                stepId: STEP_IMPL,
                workflowRunId: RUN_ID,
                status: 'pending',
                name: 'Refactor',
                ordinal: 2,
              }),
            ],
          },
        }),
      });
    });

    it.each([
      ['Review', 's-review'],
      ['Test', 's-test'],
      ['Scout', 's-scout'],
      ['Plan', 's-plan2'],
      ['Docs', 's-docs'],
    ])('says the next step (%s) does not run plans', async (name, id) => {
      const stepId = id as StepId;
      const wf = makeWorkflow([
        { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
        { id: stepId, name, ordinal: 1 },
      ]);
      await expectRefused({
        reason: `The next step (${name}) does not run plans`,
        state: defaultState({
          phaseTemplates: { [WS_ID]: [wf] },
          sessionPhaseRuns: {
            [SESSION_ID]: [
              makeAgent({
                id: CREATOR_AGENT_ID,
                stepId: STEP_PLAN,
                workflowRunId: RUN_ID,
                status: 'completed',
                name: 'Plan',
                ordinal: 0,
              }),
              makeAgent({
                id: 'agent-next' as AgentId,
                stepId,
                workflowRunId: RUN_ID,
                status: 'pending',
                name,
                ordinal: 1,
              }),
            ],
          },
        }),
      });
    });

    it('says the step already started when no agent of the next step is waiting', async () => {
      await expectRefused({
        reason: 'Step 2 already started',
        state: defaultState({
          sessionPhaseRuns: {
            [SESSION_ID]: [
              makeAgent({
                id: CREATOR_AGENT_ID,
                stepId: STEP_PLAN,
                workflowRunId: RUN_ID,
                status: 'completed',
                name: 'Plan',
                ordinal: 0,
              }),
              makeAgent({
                id: IMPL_AGENT_ID,
                stepId: STEP_IMPL,
                workflowRunId: RUN_ID,
                status: 'running',
                name: 'Refactor',
                ordinal: 1,
              }),
            ],
          },
        }),
      });
    });

    it('says the planner stopped when it failed or is blocked', async () => {
      await expectRefused({
        reason: 'The planner stopped before finishing, so this plan cannot run yet',
        state: defaultState({
          sessionPhaseRuns: {
            [SESSION_ID]: [
              makeAgent({
                id: CREATOR_AGENT_ID,
                stepId: STEP_PLAN,
                workflowRunId: RUN_ID,
                status: 'failed',
                name: 'Plan',
                ordinal: 0,
              }),
            ],
          },
        }),
      });
    });
  });

  describe('the planner is revising the plan → refuses wherever the run goes', () => {
    const revising: TurnState = {
      kind: 'running',
      runId: 'run-2' as ProviderRunId,
      startedAt: NOW,
    };

    it('refuses in a workflow without activating the next step', async () => {
      const state = defaultState({ agentTurnState: { [CREATOR_AGENT_ID]: revising } });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result).toEqual({
        kind: 'refused',
        reason: 'The planner is revising this plan',
        workflowRunId: null,
      });
      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(state.activateWorkflowAgent).not.toHaveBeenCalled();
    });

    it('refuses a plan that has no workflow too', async () => {
      const state = defaultState({
        sessions: [makeSession({ workflowRuns: [] })],
        agentTurnState: { [CREATOR_AGENT_ID]: revising },
      });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result).toMatchObject({
        kind: 'refused',
        reason: 'The planner is revising this plan',
      });
      expect(state.spawnAgent).not.toHaveBeenCalled();
    });

    it('runs once the turn that wrote the plan is the one that finished', async () => {
      const state = defaultState({
        sessionArtifacts: {
          [SESSION_ID]: [
            aStoredPlan({
              id: PLAN_ID,
              sessionId: SESSION_ID,
              agentId: CREATOR_AGENT_ID,
              sourceTurnId: 'run-2',
            }),
          ],
        },
        agentTurnState: { [CREATOR_AGENT_ID]: revising },
      });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result.kind).toBe('started');
    });
  });

  describe('spawning does not steal focus', () => {
    it('activates the workflow slot without focus and hands back the agent to open', async () => {
      const state = defaultState();
      const slice = buildSlice(state);

      const result = await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.activateWorkflowAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        agentId: IMPL_AGENT_ID,
        explicitPlanId: PLAN_ID,
        focus: 'none',
      });
      expect(result).toMatchObject({ kind: 'started', agentId: IMPL_AGENT_ID });
    });

    it('still routes the plan to its step while a sibling agent is running', async () => {
      const wf = makeWorkflow([
        { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
        { id: STEP_IMPL, name: 'Refactor', ordinal: 1 },
        { id: STEP_REVIEW, name: 'Review', ordinal: 2 },
      ]);
      const state = defaultState({
        phaseTemplates: { [WS_ID]: [wf] },
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: CREATOR_AGENT_ID,
              stepId: STEP_PLAN,
              workflowRunId: RUN_ID,
              status: 'completed',
              name: 'Plan',
              ordinal: 0,
            }),
            makeAgent({
              id: IMPL_AGENT_ID,
              stepId: STEP_IMPL,
              workflowRunId: RUN_ID,
              status: 'pending',
              name: 'Refactor',
              ordinal: 1,
            }),
            makeAgent({
              id: 'agent-review' as AgentId,
              stepId: STEP_REVIEW,
              workflowRunId: RUN_ID,
              status: 'running',
              name: 'Review',
              ordinal: 2,
            }),
          ],
        },
      });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(result).toMatchObject({ kind: 'started', agentId: IMPL_AGENT_ID });
    });

    it('free-spawns without focus and hands back the spawned agent', async () => {
      const state = defaultState({ sessions: [makeSession({ workflowRuns: [] })] });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent.mock.calls[0]![1]).toMatchObject({ focus: 'none' });
      expect(result).toMatchObject({ kind: 'started', agentId: 'spawned' });
    });
  });

  describe('invariants', () => {
    it('exactly one dispatch per runPlan (in-workflow activates, fallback spawns, never both)', async () => {
      const inWorkflow = defaultState();
      await buildSlice(inWorkflow).runPlan(SESSION_ID, PLAN_ID);
      expect(
        inWorkflow.spawnAgent.mock.calls.length +
          inWorkflow.activateWorkflowAgent.mock.calls.length,
      ).toBe(1);
      expect(inWorkflow.activateWorkflowAgent).toHaveBeenCalledTimes(1);

      const freeSpawn = defaultState({ sessions: [makeSession({ workflowRuns: [] })] });
      await buildSlice(freeSpawn).runPlan(SESSION_ID, PLAN_ID);
      expect(
        freeSpawn.spawnAgent.mock.calls.length + freeSpawn.activateWorkflowAgent.mock.calls.length,
      ).toBe(1);
      expect(freeSpawn.spawnAgent).toHaveBeenCalledTimes(1);
    });

    it('a refusal dispatches nothing at all', async () => {
      const wf = makeWorkflow([
        { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
        { id: STEP_REVIEW, name: 'Review', ordinal: 1 },
      ]);
      const state = defaultState({
        phaseTemplates: { [WS_ID]: [wf] },
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: CREATOR_AGENT_ID,
              stepId: STEP_PLAN,
              workflowRunId: RUN_ID,
              status: 'completed',
              name: 'Plan',
              ordinal: 0,
            }),
            makeAgent({
              id: 'agent-review' as AgentId,
              stepId: STEP_REVIEW,
              workflowRunId: RUN_ID,
              status: 'pending',
              name: 'Review',
              ordinal: 1,
            }),
          ],
        },
      });

      const result = await buildSlice(state).runPlan(SESSION_ID, PLAN_ID);

      expect(result.kind).toBe('refused');
      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(state.activateWorkflowAgent).not.toHaveBeenCalled();
      expect(state.emitNotification).not.toHaveBeenCalled();
    });

    it('the clicked plan is routed in every branch that starts an agent', async () => {
      const scenarios: Array<{ name: string; state: FakeState }> = [
        { name: 'happy path', state: defaultState() },
        {
          name: 'gate A',
          state: defaultState({ sessions: [makeSession({ workflowRuns: [] })] }),
        },
        {
          name: 'gate B',
          state: defaultState({
            sessionPhaseRuns: {
              [SESSION_ID]: [
                makeAgent({ id: CREATOR_AGENT_ID, status: 'completed', name: 'free', ordinal: 0 }),
              ],
            },
          }),
        },
        { name: 'gate C', state: defaultState({ phaseTemplates: {} }) },
      ];

      for (const { name, state } of scenarios) {
        const slice = buildSlice(state);
        await slice.runPlan(SESSION_ID, PLAN_ID);

        if (state.activateWorkflowAgent.mock.calls.length > 0) {
          const [params] = state.activateWorkflowAgent.mock.calls[0]!;
          expect(params.explicitPlanId, `${name} must route the clicked plan`).toBe(PLAN_ID);
        } else {
          const [, args] = state.spawnAgent.mock.calls[0]!;
          expect(args.triggeredPlanId, `${name} must carry triggeredPlanId`).toBe(PLAN_ID);
        }
      }
    });
  });
});
