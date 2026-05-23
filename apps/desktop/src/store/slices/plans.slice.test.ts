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
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('../../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { exec: vi.fn(), execute: vi.fn(), select: vi.fn() },
}));

import { createPlansSlice } from './plans.slice';
import { AGENT_KIND_DEFAULTS } from '../../features/session/agent-kind';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-refactor' as WorkflowId;
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
    providerPreference: { kind: 'auto' } as Session['providerPreference'],
    permissionMode: 'default' as Session['permissionMode'],
    workflowId: WF_ID,
    autoRun: false,
    titleUserEdited: false,
    userStatus: 'wip',
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

interface FakeState {
  sessions: ReadonlyArray<Session>;
  sessionPlans: Record<SessionId, ReadonlyArray<PlanWithCount>>;
  sessionPhaseRuns: Record<SessionId, ReadonlyArray<Agent>>;
  phaseTemplates: Record<WorkspaceId, ReadonlyArray<Workflow>>;
  spawnAgent: ReturnType<typeof vi.fn>;
}

function buildSlice(state: FakeState) {
  const set = vi.fn();
  // Cast through unknown — the slice only touches the few fields above; the
  // rest of AppStore is intentionally absent to keep the harness narrow.
  const get = (() => state) as unknown as Parameters<typeof createPlansSlice>[1];
  return createPlansSlice(set as unknown as Parameters<typeof createPlansSlice>[0], get);
}

function defaultState(overrides: Partial<FakeState> = {}): FakeState {
  const session = makeSession();
  const plan = makePlan();
  const creator: Agent = makeAgent({
    id: CREATOR_AGENT_ID,
    stepId: STEP_PLAN,
    status: 'completed',
    name: 'Plan',
    ordinal: 0,
  });
  const nextImpl: Agent = makeAgent({
    id: IMPL_AGENT_ID,
    stepId: STEP_IMPL,
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
    ...overrides,
  };
}

describe('runPlan — workflow-aware spawn routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('in-workflow spawn (all gates pass)', () => {
    it('routes to the next implementer step via stepId when plan was created inside the workflow', async () => {
      const state = defaultState();
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent).toHaveBeenCalledTimes(1);
      const [sid, args] = state.spawnAgent.mock.calls[0]!;
      expect(sid).toBe(SESSION_ID);
      expect(args).toEqual({
        stepId: STEP_IMPL,
        triggeredPlanId: PLAN_ID,
        model: AGENT_KIND_DEFAULTS.implementer.model,
      });
      // No kindOverride — agent kind must come from the step name so the
      // workflow slot's role wins over the implementer default.
      expect(args).not.toHaveProperty('kindOverride');
    });

    it('uses implementer model default (sonnet) for the in-workflow spawn', async () => {
      const state = defaultState();
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      const [, args] = state.spawnAgent.mock.calls[0]!;
      expect(args.model).toBe('claude-sonnet-4-5');
      expect(args.model).toBe(AGENT_KIND_DEFAULTS.implementer.model);
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

        const [, args] = state.spawnAgent.mock.calls[0]!;
        expect(args, `alias "${name}" should route in-workflow`).toMatchObject({
          stepId: STEP_IMPL,
          triggeredPlanId: PLAN_ID,
        });
      }
    });
  });

  describe('gate A — session has no workflowId → free-spawn', () => {
    it('free-spawns an implementer when session has no workflow attached', async () => {
      const state = defaultState({
        sessions: [makeSession({ workflowId: undefined })],
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

  describe('gate B — plan creator agent has no stepId → free-spawn', () => {
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

  describe('gate C — workflow template not resolvable → free-spawn', () => {
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

  describe('gate D — no next step available → free-spawn', () => {
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
      // creator (Plan) is still running and there is an earlier step before it
      // that hasn't completed → pickNextWorkflowStep returns null.
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

  describe('gate E — next step is not an implementer → free-spawn', () => {
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
      ['Debug', 's-debug'],
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
    it('exactly one spawnAgent call per runPlan (no double-spawn between gates)', async () => {
      const state = defaultState();
      const slice = buildSlice(state);

      await slice.runPlan(SESSION_ID, PLAN_ID);

      expect(state.spawnAgent).toHaveBeenCalledTimes(1);
    });

    it('triggeredPlanId is the clicked plan in every branch (in-workflow + every free-spawn fallback)', async () => {
      const scenarios: Array<{ name: string; state: FakeState }> = [
        { name: 'happy path', state: defaultState() },
        {
          name: 'gate A',
          state: defaultState({ sessions: [makeSession({ workflowId: undefined })] }),
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

        const [, args] = state.spawnAgent.mock.calls[0]!;
        expect(args.triggeredPlanId, `${name} must carry triggeredPlanId`).toBe(PLAN_ID);
      }
    });
  });
});
