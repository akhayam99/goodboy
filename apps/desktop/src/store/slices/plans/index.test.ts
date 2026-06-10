import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
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
vi.mock('../../../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { exec: vi.fn(), execute: vi.fn(), select: vi.fn() },
}));

import { createPlansSlice } from './index';

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
    workflowRuns: [{ id: RUN_ID, workflowId: WF_ID, ordinal: 0, currentStep: 0, autoRun: false }],
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
  phaseTemplates: Record<WorkspaceId, ReadonlyArray<Workflow>>;
  spawnAgent: ReturnType<typeof vi.fn>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
};

function buildSlice(state: FakeState) {
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof createPlansSlice>[1];
  return createPlansSlice(set as unknown as Parameters<typeof createPlansSlice>[0], get);
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
    phaseTemplates: { [WS_ID]: [wf] },
    spawnAgent: vi.fn(async () => 'spawned' as AgentId),
    activateWorkflowAgent: vi.fn(async () => undefined),
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

      await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent).not.toHaveBeenCalled();
      expect(state.activateWorkflowAgent).toHaveBeenCalledTimes(1);
      expect(state.activateWorkflowAgent).toHaveBeenCalledWith(SESSION_ID, IMPL_AGENT_ID, PLAN_ID);
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
        ).toHaveBeenCalledWith(SESSION_ID, IMPL_AGENT_ID, PLAN_ID);
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
        expect(state.activateWorkflowAgent).toHaveBeenCalledWith(
          SESSION_ID,
          IMPL_AGENT_ID,
          PLAN_ID,
        );
      },
    );
  });

  describe('gate A, session has no workflows attached → free-spawn', () => {
    it('free-spawns an implementer when session has no workflow attached', async () => {
      const state = defaultState({
        sessions: [makeSession({ workflowRuns: [] })],
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent).toHaveBeenCalledTimes(1);
      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
      expect(args).not.toHaveProperty('stepId');
    });

    it('free-spawns when the session id does not match any session in the store', async () => {
      const state = defaultState({ sessions: [] });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
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
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });

    it('free-spawns when the plan itself is missing (stale planId)', async () => {
      const state = defaultState({
        sessionPlans: { [SESSION_ID]: [] },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
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
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });
  });

  describe('gate C, workflow template not resolvable → free-spawn', () => {
    it('free-spawns when the workflow template is missing from phaseTemplates', async () => {
      const state = defaultState({ phaseTemplates: { [WS_ID]: [] } });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });

    it('free-spawns when the workspace has no phaseTemplates entry at all', async () => {
      const state = defaultState({ phaseTemplates: {} });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });
  });

  describe('gate D, no next step available → free-spawn', () => {
    it('free-spawns when all workflow steps are completed (pickNextWorkflowStep returns null)', async () => {
      const state = defaultState({
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: CREATOR_AGENT_ID,
              stepId: STEP_PLAN,
              status: 'completed',
              name: 'Plan',
              ordinal: 0,
            }),
            makeAgent({
              id: IMPL_AGENT_ID,
              stepId: STEP_IMPL,
              status: 'completed',
              name: 'Refactor',
              ordinal: 1,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });

    it('free-spawns when an earlier step is not yet done (next step blocked)', async () => {
      const earlyStep = 's-scout' as StepId;
      const wf = makeWorkflow([
        { id: earlyStep, name: 'Scout', ordinal: 0 },
        { id: STEP_PLAN, name: 'Plan', ordinal: 1 },
        { id: STEP_IMPL, name: 'Refactor', ordinal: 2 },
      ]);
      const state = defaultState({
        phaseTemplates: { [WS_ID]: [wf] },
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: 'agent-scout' as AgentId,
              stepId: earlyStep,
              status: 'pending',
              name: 'Scout',
              ordinal: 0,
            }),
            makeAgent({
              id: CREATOR_AGENT_ID,
              stepId: STEP_PLAN,
              status: 'completed',
              name: 'Plan',
              ordinal: 1,
            }),
            makeAgent({
              id: IMPL_AGENT_ID,
              stepId: STEP_IMPL,
              status: 'pending',
              name: 'Refactor',
              ordinal: 2,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });
  });

  describe('gate E, next step is not an implementer → free-spawn', () => {
    it('free-spawns when the next step is a reviewer (not implementer)', async () => {
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
              status: 'completed',
              name: 'Plan',
              ordinal: 0,
            }),
            makeAgent({
              id: 'agent-review' as AgentId,
              stepId: STEP_REVIEW,
              status: 'pending',
              name: 'Review',
              ordinal: 1,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args).toEqual({ triggeredPlanId: PLAN_ID, kindOverride: 'implementer' });
    });

    it.each([
      ['Test', 's-test'],
      ['Scout', 's-scout'],
      ['Plan', 's-plan2'],
      ['Docs', 's-docs'],
    ])('free-spawns when next step is %s', async (name, id) => {
      const stepId = id as StepId;
      const wf = makeWorkflow([
        { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
        { id: stepId, name, ordinal: 1 },
      ]);
      const state = defaultState({
        phaseTemplates: { [WS_ID]: [wf] },
        sessionPhaseRuns: {
          [SESSION_ID]: [
            makeAgent({
              id: CREATOR_AGENT_ID,
              stepId: STEP_PLAN,
              status: 'completed',
              name: 'Plan',
              ordinal: 0,
            }),
            makeAgent({
              id: 'agent-next' as AgentId,
              stepId,
              status: 'pending',
              name,
              ordinal: 1,
            }),
          ],
        },
      });
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args, `next step "${name}" must trigger free-spawn`).toEqual({
        triggeredPlanId: PLAN_ID,
        kindOverride: 'implementer',
      });
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

    it('the clicked plan is routed in every branch (in-workflow activation + every free-spawn fallback)', async () => {
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
        {
          name: 'gate E',
          state: (() => {
            const wf = makeWorkflow([
              { id: STEP_PLAN, name: 'Plan', ordinal: 0 },
              { id: STEP_REVIEW, name: 'Review', ordinal: 1 },
            ]);
            return defaultState({
              phaseTemplates: { [WS_ID]: [wf] },
              sessionPhaseRuns: {
                [SESSION_ID]: [
                  makeAgent({
                    id: CREATOR_AGENT_ID,
                    stepId: STEP_PLAN,
                    status: 'completed',
                    name: 'Plan',
                    ordinal: 0,
                  }),
                  makeAgent({
                    id: 'agent-review' as AgentId,
                    stepId: STEP_REVIEW,
                    status: 'pending',
                    name: 'Review',
                    ordinal: 1,
                  }),
                ],
              },
            });
          })(),
        },
      ];

      for (const { name, state } of scenarios) {
        const slice = buildSlice(state);
        await slice.runPlan(SESSION_ID, PLAN_ID);

        if (state.activateWorkflowAgent.mock.calls.length > 0) {
          const [, , planId] = state.activateWorkflowAgent.mock.calls[0]!;
          expect(planId, `${name} must route the clicked plan`).toBe(PLAN_ID);
        } else {
          const [, args] = state.spawnAgent.mock.calls[0]!;
          expect(args.triggeredPlanId, `${name} must carry triggeredPlanId`).toBe(PLAN_ID);
        }
      }
    });
  });
});
