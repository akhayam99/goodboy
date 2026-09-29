import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  ProjectId,
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

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;
const phaseRunInsertSpy = storySpies.invokeAgentInsert;
const phaseRunListSpy = storySpies.invokeAgentList;
const phaseRunUpdateStatusSpy = storySpies.invokeAgentUpdateStatus;

async function* emptyStream(): AsyncIterable<TurnEvent> {}

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

const upsertPlanSpy = storySpies.upsertPlan;
const listPlansForSessionSpy = storySpies.listPlansForSession;
const addPlanConsumptionSpy = storySpies.addPlanConsumption;
const listConsumptionsForPlanSpy = storySpies.listConsumptionsForPlan;

const wirePlanBacking = () => {
  upsertPlanSpy.mockImplementation(async (args: UpsertPlanArgs): Promise<PlanWithCount> => {
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
  listPlansForSessionSpy.mockImplementation(
    async (sessionId?: unknown): Promise<ReadonlyArray<PlanWithCount>> =>
      planBacking.plans.filter((p) => p.sessionId === sessionId),
  );
  addPlanConsumptionSpy.mockImplementation(
    async (planId: PlanId, agentId: AgentId): Promise<PlanConsumption> => {
      planBacking.plans = planBacking.plans.map((p) =>
        p.id === planId
          ? { ...p, status: 'consumed', consumptionCount: p.consumptionCount + 1 }
          : p,
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
  listConsumptionsForPlanSpy.mockImplementation(
    async (planId: PlanId): Promise<ReadonlyArray<PlanConsumption>> =>
      planBacking.consumptions[planId] ?? [],
  );
};

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
        executionMode: 'static' as const,
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
  phaseRunListSpy.mockImplementation(async () => phaseRuns);
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
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          projectId: 'project-turn' as ProjectId,
          mountName: 'repo',
          worktreePath: '/tmp/wt',
          repoRoot: '/tmp/repo',
          branch: 'goodboy/turn',
        },
      ],
    },
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('autorun plan consumption ordering', () => {
  let idleSpy: typeof globalThis.requestIdleCallback | undefined;

  beforeEach(async () => {
    resetStorySpies();
    planBacking.plans = [];
    planBacking.consumptions = {};
    planBacking.seq = 0;
    wirePlanBacking();
    wirePhaseSpies();
    runTurnSpy.mockImplementation(() => emptyStream());
    fanOutClustersSpy.mockClear();
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
    await vi.waitFor(() =>
      expect(addPlanConsumptionSpy).toHaveBeenCalledWith(persisted.id, IMPL_ID),
    );
    expect(planBacking.plans[0]!.status).toBe('consumed');
    expect(planBacking.consumptions[persisted.id]).toHaveLength(1);

    await vi.waitFor(() => expect(runTurnSpy).toHaveBeenCalledTimes(2));
    const kickoffPrompt = runTurnSpy.mock.calls
      .map((c) => String((c[0] as { prompt?: unknown }).prompt ?? ''))
      .find((p) => p.includes('do the thing'));
    expect(kickoffPrompt).toBeDefined();
  });

  it('does not auto-advance on empty planner output: retries then fails the step', async () => {
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
    await vi.waitFor(() =>
      expect(addPlanConsumptionSpy).toHaveBeenCalledWith(persisted.id, IMPL_ID),
    );
    await vi.waitFor(() => expect(fanOutClustersSpy).toHaveBeenCalledTimes(1));
  });

  it('persists the plan strictly before recording its consumption (race-fix invariant)', async () => {
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
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBe(PLANNER_ID);
  });

  it('captures the plan but records no consumption outside a workflow', async () => {
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
