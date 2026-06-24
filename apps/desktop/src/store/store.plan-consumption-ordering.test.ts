import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ImplementationCluster,
  IsoDateTime,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanWithCount,
  Session,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type UpsertPlanArgs = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowRunId?: WorkflowRunId;
  readonly title: string;
  readonly bodyMd: string;
  readonly clusters?: ReadonlyArray<ImplementationCluster>;
};

const runTurnSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

async function* emptyStream(): AsyncIterable<TurnEvent> {}

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn(async () => []) },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listOpenQuestionsForSession: vi.fn(async () => []),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  updateSessionWorkflowStep: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  listResolvedQuestionTextsForSession: vi.fn(async () => []),
  insertTurnEvent: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAgentsForSessions: vi.fn(async () => new Map()),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  attachWorkflowToSession: vi.fn(),
  detachWorkflowFromSession: vi.fn(),
  updateWorkflowOrder: vi.fn(),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-opus-4-5',
    reason: 'preference',
  })),
}));

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

const phaseRunInsertSpy = vi.fn();
const phaseRunListSpy = vi.fn();
const phaseRunUpdateStatusSpy = vi.fn();

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentList: (sid: SessionId) => phaseRunListSpy(sid),
  invokeAgentInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokeAgentUpdateStatus: (id: unknown, fields: unknown) => phaseRunUpdateStatusSpy(id, fields),
  invokeAgentMarkViewed: vi.fn(async () => undefined),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../shared/lib/repo', () => ({ validateGitRepo: vi.fn() }));

const fanOutClustersSpy = vi.fn(async () => undefined);

vi.mock('./slices/workflows/clusterImplementation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./slices/workflows/clusterImplementation')>();
  return {
    ...actual,
    fanOutClusters: fanOutClustersSpy,
    advanceClusterImplementation: () => async () => undefined,
  };
});

type PlanBackingStore = {
  plans: PlanWithCount[];
  consumptions: Record<string, PlanConsumption[]>;
  seq: number;
};

const planBacking: PlanBackingStore = { plans: [], consumptions: {}, seq: 0 };

const upsertPlanSpy = vi.fn(async (args: UpsertPlanArgs): Promise<PlanWithCount> => {
  planBacking.seq += 1;
  const plan: PlanWithCount = {
    id: `plan-${planBacking.seq}` as PlanId,
    sessionId: args.sessionId,
    agentId: args.agentId,
    ...(args.workflowRunId !== undefined && { workflowRunId: args.workflowRunId }),
    title: args.title,
    bodyMd: args.bodyMd,
    ...(args.clusters && { clusters: args.clusters }),
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  planBacking.plans.push(plan);
  return plan;
});

const listPlansForSessionSpy = vi.fn(
  async (sessionId: SessionId): Promise<ReadonlyArray<PlanWithCount>> =>
    planBacking.plans.filter((p) => p.sessionId === sessionId),
);

const addPlanConsumptionSpy = vi.fn(
  async (planId: PlanId, agentId: AgentId): Promise<PlanConsumption> => {
    planBacking.plans = planBacking.plans.map((p) =>
      p.id === planId ? { ...p, status: 'consumed', consumptionCount: p.consumptionCount + 1 } : p,
    );
    const consumption: PlanConsumption = {
      id: `pc-${planBacking.seq}-${agentId}` as PlanConsumptionId,
      planId,
      agentId,
      agentName: null,
      consumedAt: NOW,
    };
    planBacking.consumptions[planId] = [...(planBacking.consumptions[planId] ?? []), consumption];
    return consumption;
  },
);

const listConsumptionsForPlanSpy = vi.fn(
  async (planId: PlanId): Promise<ReadonlyArray<PlanConsumption>> =>
    planBacking.consumptions[planId] ?? [],
);

vi.mock('../features/plans/plans', () => ({
  listPlansForSession: (sessionId: SessionId) => listPlansForSessionSpy(sessionId),
  upsertPlan: (args: UpsertPlanArgs) => upsertPlanSpy(args),
  addPlanConsumption: (planId: PlanId, agentId: AgentId) => addPlanConsumptionSpy(planId, agentId),
  listConsumptionsForPlan: (planId: PlanId) => listConsumptionsForPlanSpy(planId),
  setPlanStatus: vi.fn(async () => undefined),
  setPlanBody: vi.fn(async () => undefined),
  deletePlan: vi.fn(async () => undefined),
}));

const WS_ID = 'ws-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-plan-impl' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const SESSION_ID = 'ses-1' as SessionId;
const PLANNER_ID = 'a-plan' as AgentId;
const IMPL_ID = 'a-impl' as AgentId;
const STEP_PLAN = 's-plan' as StepId;
const STEP_IMPL = 's-impl' as StepId;
const NOW = '2026-06-10T00:00:00.000Z' as IsoDateTime;

const PLAN_MARKER = '<<plan>>\nThe Plan\n\ndo the thing<</plan>>';
const PLAN_MARKER_WITH_CLUSTERS = `${PLAN_MARKER}\n<<clusters>>\n[{"title":"cluster a","instructions":"i1"},{"title":"cluster b","instructions":"i2"}]\n<</clusters>>`;

function makeWorkflow(): Workflow {
  return {
    id: WORKFLOW_ID,
    workspaceId: WS_ID,
    name: 'Plan then implement',
    description: '',
    steps: [
      { id: STEP_PLAN, workflowId: WORKFLOW_ID, ordinal: 0, name: 'Plan', promptPrefix: '' },
      {
        id: STEP_IMPL,
        workflowId: WORKFLOW_ID,
        ordinal: 1,
        name: 'Implement',
        promptPrefix: 'execute the plan',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'ship it',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: true,
    titleUserEdited: false,
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        currentStep: 0,
        autoRun: true,
        triggerMode: 'immediate' as const,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

let phaseRuns: Agent[] = [];

function wirePhaseSpies() {
  phaseRuns = [
    {
      id: PLANNER_ID,
      sessionId: SESSION_ID,
      stepId: STEP_PLAN,
      workflowRunId: RUN_ID,
      ordinal: 0,
      name: 'Plan',
      status: 'pending',
      kind: 'planner',
    },
    {
      id: IMPL_ID,
      sessionId: SESSION_ID,
      stepId: STEP_IMPL,
      workflowRunId: RUN_ID,
      ordinal: 1,
      name: 'Implement',
      status: 'pending',
      kind: 'implementer',
    },
  ];
  phaseRunListSpy.mockReset();
  phaseRunListSpy.mockImplementation(async () => phaseRuns);
  phaseRunInsertSpy.mockReset();
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const row: Agent = {
      id: `inserted-${phaseRuns.length + 1}` as AgentId,
      sessionId: args['sessionId'] as SessionId,
      ordinal: args['ordinal'] as number,
      name: args['name'] as string,
      status: (args['status'] as Agent['status']) ?? 'pending',
      ...((args['stepId'] as StepId | undefined) !== undefined && {
        stepId: args['stepId'] as StepId,
      }),
    };
    phaseRuns.push(row);
    return row;
  });
  phaseRunUpdateStatusSpy.mockReset();
  phaseRunUpdateStatusSpy.mockImplementation(
    async (id: AgentId, fields: Record<string, unknown>) => {
      let updated: Agent | undefined;
      phaseRuns = phaseRuns.map((r) => {
        if (r.id !== id) {
          return r;
        }
        updated = { ...r, status: (fields['status'] as Agent['status']) ?? r.status };
        return updated;
      });
      return updated ?? { id, sessionId: SESSION_ID, ordinal: 0, name: '', status: 'running' };
    },
  );
}

function seedStore(useAppStore: { setState: (s: Record<string, unknown>) => void }) {
  useAppStore.setState({
    currentWorkspaceId: WS_ID,
    sessions: [makeSession()],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
    sessionPhaseRuns: { [SESSION_ID]: phaseRuns },
    selectedAgentId: { [SESSION_ID]: PLANNER_ID },
    transcripts: { [PLANNER_ID]: [], [IMPL_ID]: [] },
    phaseTemplates: { [WS_ID]: [makeWorkflow()] },
    sessionPlans: {},
    planConsumptions: {},
    budgetAlerts: [],
    providers: [
      {
        id: 'anthropic',
        binary: 'claude',
        connection: 'connected',
        name: 'Claude',
        installation: 'installed',
      } as never,
    ],
    authResults: { anthropic: { state: 'connected', identity: 'test' } } as never,
    workspaces: [{ id: WS_ID, name: 'ws', rootPath: '/tmp', createdAt: NOW, updatedAt: NOW }],
  });
}

function streamText(text: string) {
  return async function* (args: { runId: string }): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text' as const, runId: args.runId as never, delta: text, at: NOW };
    yield { kind: 'done' as const, runId: args.runId as never, at: NOW };
  };
}

describe('autorun plan consumption ordering', () => {
  let idleSpy: typeof globalThis.requestIdleCallback | undefined;

  beforeEach(async () => {
    planBacking.plans = [];
    planBacking.consumptions = {};
    planBacking.seq = 0;
    wirePhaseSpies();
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    fanOutClustersSpy.mockClear();
    addPlanConsumptionSpy.mockClear();
    upsertPlanSpy.mockClear();
    listPlansForSessionSpy.mockClear();
    idleSpy = globalThis.requestIdleCallback;
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = (cb: () => void) =>
      setTimeout(cb, 0) as unknown as number;
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-opus-4-5',
      reason: 'preference',
    });
  });

  afterEach(() => {
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = idleSpy;
    vi.clearAllMocks();
  });

  it('persists the plan before the implementer reads it, recording a consumption (plan flips to consumed)', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    runTurnSpy
      .mockImplementationOnce(streamText(PLAN_MARKER))
      .mockImplementationOnce(streamText(`<<step-done id="${IMPL_ID}">>`));

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    const persisted = planBacking.plans[0]!;
    expect(persisted.bodyMd).toBe('do the thing');
    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(persisted.id, IMPL_ID);
    expect(planBacking.plans[0]!.status).toBe('consumed');
    expect(planBacking.consumptions[persisted.id]).toHaveLength(1);

    await vi.waitFor(() => expect(runTurnSpy).toHaveBeenCalledTimes(2));
    const kickoffPrompt = runTurnSpy.mock.calls
      .map((c) => String((c[0] as { prompt?: unknown }).prompt ?? ''))
      .find((p) => p.includes('do the thing'));
    expect(kickoffPrompt).toBeDefined();
  });

  it('does not auto-advance on empty planner output: retries then fails the step', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    runTurnSpy.mockImplementation(() => emptyStream());

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    await vi.waitFor(() =>
      expect(phaseRunUpdateStatusSpy).toHaveBeenCalledWith(
        PLANNER_ID,
        expect.objectContaining({ status: 'failed' }),
      ),
    );
    expect(upsertPlanSpy).not.toHaveBeenCalled();
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe(PLANNER_ID);
  });

  it('fans out when the persisted plan carries 2+ clusters, after recording the consumption', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    runTurnSpy.mockImplementationOnce(streamText(PLAN_MARKER_WITH_CLUSTERS));

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    const persisted = planBacking.plans[0]!;
    expect(persisted.clusters).toHaveLength(2);
    expect(addPlanConsumptionSpy).toHaveBeenCalledWith(persisted.id, IMPL_ID);
    expect(fanOutClustersSpy).toHaveBeenCalledTimes(1);
  });

  it('persists the plan strictly before recording its consumption (race-fix invariant)', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    runTurnSpy
      .mockImplementationOnce(streamText(PLAN_MARKER))
      .mockImplementationOnce(streamText(`<<step-done id="${IMPL_ID}">>`));

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    await vi.waitFor(() => expect(addPlanConsumptionSpy).toHaveBeenCalledTimes(1));
    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    expect(upsertPlanSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      addPlanConsumptionSpy.mock.invocationCallOrder[0]!,
    );
  });

  it('does not auto-advance or capture a plan when the planner turn errors', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    runTurnSpy.mockImplementationOnce(() => {
      throw new Error('provider boom');
    });

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: SESSION_ID,
        agentId: PLANNER_ID,
        content: 'plan it',
      }),
    ).rejects.toThrow('provider boom');

    expect(upsertPlanSpy).not.toHaveBeenCalled();
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe(PLANNER_ID);
  });

  it('still auto-advances when plan capture fails, recording no consumption', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    upsertPlanSpy.mockRejectedValueOnce(new Error('db unavailable'));
    runTurnSpy
      .mockImplementationOnce(streamText(PLAN_MARKER))
      .mockImplementationOnce(streamText(`<<step-done id="${IMPL_ID}">>`));

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    expect(planBacking.plans).toHaveLength(0);
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(runTurnSpy).toHaveBeenCalledTimes(2));
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe(IMPL_ID);
  });

  it('captures the plan but records no consumption outside a workflow', async () => {
    const { useAppStore } = await import('./store');
    seedStore(useAppStore);
    useAppStore.setState({ sessions: [{ ...makeSession(), workflowRuns: [] }] });
    runTurnSpy.mockImplementationOnce(streamText(PLAN_MARKER));

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: PLANNER_ID,
      content: 'plan it',
    });

    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    expect(addPlanConsumptionSpy).not.toHaveBeenCalled();
    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe(PLANNER_ID);
  });
});
