import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSessionById,
  insertAgent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type PlanId,
  type PlanWithCount,
  type ProviderRunId,
  type SessionId,
  type StepId,
  type TurnEvent,
  type Workflow,
  type WorkflowId,
  type WorkflowRules,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { WorkflowGateError } from './slices/workflows/workflowActivationGate';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  STORY_NOW,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
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

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const WORKFLOW_ID = 'workflow-retry-payments' as WorkflowId;
const STEP_NAMES = ['Plan', 'Implement', 'Test'] as const;
const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const stepIdOf = (index: number) => `step-retry-${index}` as StepId;

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: STEP_NAMES.map((name, ordinal) => ({
    id: stepIdOf(ordinal),
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: `${name} the retry changes in payments-api`,
  })),
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

type RunArgs = { readonly runId: ProviderRunId; readonly prompt: string };

type Turn = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
  readonly finish: () => void;
};

const STEP_DONE = /<<step-done id="([^"]+)">>/;

let useAppStore: StoryStore;
let sessionId: SessionId;
let turns: Array<Turn>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const fakeProvider = ({ runId, prompt }: RunArgs) => {
  const agentId = (prompt.match(STEP_DONE)?.[1] ?? '') as AgentId;
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  turns.push({ runId, agentId, finish });
  return (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'Working on the retry changes.\n', at: AT };
    await finished;
    yield { kind: 'assistant_text', runId, delta: `<<step-done id="${agentId}">>`, at: AT };
  })();
};

beforeEach(async () => {
  await resetStoryStore();
  turns = [];
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  for (const step of template.steps) {
    await db.execute(
      'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
      [step.id, WORKFLOW_ID, step.ordinal, step.name, step.promptPrefix],
    );
  }
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  storySpies.invokeAgentInsert.mockImplementation((run: AgentInsertArgs) =>
    insertAgent(storySqlite(), run),
  );
  storySpies.invokeAgentList.mockImplementation(async (id: unknown) => [
    ...((await listAgentsForSessions(storySqlite(), [id as SessionId])).get(id as SessionId) ?? []),
  ]);
  storySpies.invokeAgentUpdateStatus.mockImplementation((id: AgentId, fields) =>
    recordAgentStatus(storySqlite(), id, fields),
  );
  storySpies.cancelTurn.mockImplementation(async (runId: unknown) => {
    turns.find((turn) => turn.runId === runId)?.finish();
  });
  storySpies.runTurn.mockImplementation(fakeProvider);
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Retry payments through ledger-core',
  });
  sessionId = session.id as SessionId;
});

afterEach(async () => {
  for (const turn of turns) {
    turn.finish();
  }
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const runIdOfSession = (): WorkflowRunId => {
  const run = useAppStore.getState().sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns[0];
  if (run === undefined) {
    throw new Error('the run was not attached');
  }
  return run.id;
};

const attachRun = async ({ autoRun }: { readonly autoRun: boolean }) => {
  await useAppStore
    .getState()
    .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun, triggerMode: 'manual' });
  return runIdOfSession();
};

const agentIdOf = (name: (typeof STEP_NAMES)[number]): AgentId => {
  const agent = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.name === name,
  );
  if (agent === undefined) {
    throw new Error(`no agent for ${name}`);
  }
  return agent.id;
};

const statuses = async () =>
  rowsOf<{ name: string; status: string }>({
    sql: 'SELECT name, status FROM agents WHERE session_id = ? AND step_id IS NOT NULL ORDER BY ordinal',
    params: [sessionId],
  });

const startedNames = () =>
  turns.map(
    (turn) =>
      (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
        (agent) => agent.id === turn.agentId,
      )?.name,
  );

const startStep = async (name: (typeof STEP_NAMES)[number]) => {
  const pending = useAppStore.getState().activateWorkflowAgent({
    sessionId,
    agentId: agentIdOf(name),
    bypassGate: true,
  });
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[agentIdOf(name)]?.kind).toBe('running'),
  );
  return { finished: pending };
};

const runOf = (workflowRunId: WorkflowRunId) =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === workflowRunId);

const PLAN_RULES: WorkflowRules = { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' };

const planFor = (workflowRunId: WorkflowRunId): PlanWithCount => ({
  id: 'plan-retry' as PlanId,
  sessionId,
  agentId: 'agent-planner' as AgentId,
  workflowRunId,
  title: 'Retry with backoff',
  bodyMd: '1. Add backoff\n2. Cover it with tests',
  status: 'active',
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 0,
});

const attachAutoRun = async ({ rules }: { readonly rules: WorkflowRules }) => {
  await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
    autoRun: true,
    triggerMode: 'immediate',
    rulesSnapshot: rules,
  });
  await vi.waitFor(() => expect(startedNames()).toEqual(['Plan']));
  return runIdOfSession();
};

const attachPlanRun = () => attachAutoRun({ rules: PLAN_RULES });

const finishPlanStep = async (
  workflowRunId: WorkflowRunId,
  { writesPlan = true }: { readonly writesPlan?: boolean } = {},
) => {
  if (writesPlan) {
    storySpies.listPlansForSession.mockResolvedValue([planFor(workflowRunId)]);
  }
  turns[0]?.finish();
  await vi.waitFor(async () => expect((await statuses())[0]?.status).toBe('completed'));
};

const storedRun = async (workflowRunId: WorkflowRunId) =>
  (await getSessionById(storySqlite(), sessionId))?.workflowRuns.find(
    (run) => run.id === workflowRunId,
  );

describe('store on sqlite: workflow rules', () => {
  it('copies the rules into a run so a later change shows only in a new run, also after a restart', async () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: 25 },
        },
      },
    });
    const first = await attachRun({ autoRun: false });
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: 10 },
        },
      },
    });
    await useAppStore
      .getState()
      .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: true, triggerMode: 'manual' });
    const second = useAppStore
      .getState()
      .sessions.find((candidate) => candidate.id === sessionId)
      ?.workflowRuns.find((run) => run.id !== first)?.id;
    if (second === undefined) {
      throw new Error('the second run was not attached');
    }

    expect((await storedRun(first))?.rulesSnapshot).toEqual({
      ...DEFAULT_WORKFLOW_RULES,
      spendLimitUsd: 25,
      autonomy: 'step',
    });
    expect((await storedRun(second))?.rulesSnapshot).toEqual({
      ...DEFAULT_WORKFLOW_RULES,
      spendLimitUsd: 10,
      autonomy: 'run',
    });
  });
});

describe('store on sqlite: ask after the plan', () => {
  it('holds autorun once the plan is written and runs on its own after you approve it', async () => {
    const workflowRunId = await attachPlanRun();
    await finishPlanStep(workflowRunId);

    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    await vi.waitFor(async () =>
      expect((await storedRun(workflowRunId))?.orchestrationStop?.kind).toBe('plan-approval'),
    );
    expect(startedNames()).toEqual(['Plan']);
    expect(runOf(workflowRunId)?.autoRun).toBe(true);

    await useAppStore.getState().approveWorkflowRunPlan(sessionId, workflowRunId);
    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement']));
    turns[1]?.finish();
    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement', 'Test']));

    const stored = await storedRun(workflowRunId);
    expect(stored?.orchestrationStop).toBeUndefined();
    expect(stored?.rulesSnapshot?.planApproved).toBe(true);
  });

  it('admits no work past the plan from the step button, a bypassing launch, a skip or a hint', async () => {
    const workflowRunId = await attachPlanRun();
    await finishPlanStep(workflowRunId);

    await expect(
      useAppStore.getState().activateWorkflowAgent({
        sessionId,
        agentId: agentIdOf('Implement'),
        focus: 'agent',
      }),
    ).rejects.toBeInstanceOf(WorkflowGateError);
    await expect(
      useAppStore.getState().activateWorkflowAgent({
        sessionId,
        agentId: agentIdOf('Implement'),
        bypassGate: true,
      }),
    ).rejects.toBeInstanceOf(WorkflowGateError);
    await useAppStore.getState().skipStuckStepAndAdvance(sessionId, workflowRunId, {
      force: true,
      agentId: agentIdOf('Implement'),
    });
    await useAppStore.getState().addWorkflowOrchestratorHint(sessionId, workflowRunId, {
      text: 'Keep the retry budget at three attempts',
      delivery: 'now',
    });

    expect(startedNames()).toEqual(['Plan']);
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('plan-approval');
  });

  it('keeps the hold across a restart', async () => {
    const workflowRunId = await attachPlanRun();
    await finishPlanStep(workflowRunId);
    await vi.waitFor(async () =>
      expect((await storedRun(workflowRunId))?.orchestrationStop?.kind).toBe('plan-approval'),
    );

    const reloaded = await getSessionById(storySqlite(), sessionId);
    if (reloaded === null) {
      throw new Error('session missing');
    }
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId ? reloaded : candidate,
      ),
    }));
    storySpies.listPlansForSession.mockResolvedValue([]);
    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    expect(startedNames()).toEqual(['Plan']);
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('plan-approval');
    expect(runOf(workflowRunId)?.rulesSnapshot?.autonomy).toBe('plan');
  });

  it('does not hold a run whose plan step wrote no plan', async () => {
    const workflowRunId = await attachPlanRun();
    await finishPlanStep(workflowRunId, { writesPlan: false });

    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement']));
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();
  });

  it('holds again when a held orchestrated run is retried', async () => {
    await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
      autoRun: true,
      triggerMode: 'manual',
      executionMode: 'dynamic',
      rulesSnapshot: PLAN_RULES,
    });
    const workflowRunId = runIdOfSession();
    storySpies.listPlansForSession.mockResolvedValue([planFor(workflowRunId)]);

    await useAppStore.getState().orchestrateNextStep(sessionId, workflowRunId);
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('plan-approval');
    await useAppStore.getState().retryWorkflowOrchestration(sessionId, workflowRunId);

    expect((await storedRun(workflowRunId))?.orchestrationStop?.kind).toBe('plan-approval');
    expect(storySpies.runTurn).not.toHaveBeenCalled();
  });

  it('leaves a run that asks before each step or runs on its own as it is today', async () => {
    const workflowRunId = await attachAutoRun({ rules: { ...PLAN_RULES, autonomy: 'run' } });
    await finishPlanStep(workflowRunId);

    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement']));
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();
  });

  it('drops the hold when you switch the run to run on its own', async () => {
    const workflowRunId = await attachPlanRun();
    await finishPlanStep(workflowRunId);
    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    await useAppStore.getState().setWorkflowRunAutonomy(sessionId, workflowRunId, 'run');

    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement']));
    expect((await storedRun(workflowRunId))?.rulesSnapshot?.autonomy).toBe('run');
  });
});
