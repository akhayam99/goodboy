import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSessionById,
  insertAgent,
  insertOpenQuestion,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type OpenQuestionId,
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
import type { AgentInsertArgs } from '../features/workflows/workflows';
import { aPlan, aStoredPlan } from '../test/planFixtures';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { WorkflowGateError } from './slices/workflows/workflowActivationGate';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  injectDbFault,
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
const STEP_ROLES = ['planner', 'implementer', 'tester'] as const;
const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;
const PLAN_RULES: WorkflowRules = { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' };

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
    role: STEP_ROLES[ordinal],
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
    sql: 'SELECT name, status FROM agents WHERE session_id = ? ORDER BY ordinal',
    params: [sessionId],
  });

const startedNames = () =>
  turns.map(
    (turn) =>
      (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
        (agent) => agent.id === turn.agentId,
      )?.name,
  );

const runOf = (workflowRunId: WorkflowRunId) =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === workflowRunId);

const storedRun = async (workflowRunId: WorkflowRunId) =>
  (await getSessionById(storySqlite(), sessionId))?.workflowRuns.find(
    (run) => run.id === workflowRunId,
  );

const writePlan = (workflowRunId: WorkflowRunId) => {
  storySpies.listPlansForSession.mockResolvedValue([
    aPlan({
      sessionId,
      agentId: agentIdOf('Plan'),
      workflowRunId,
      title: 'Retry with backoff',
      bodyMd: '1. Add backoff\n2. Cover it with tests',
    }),
  ]);
};

const finishPlanStep = async (workflowRunId: WorkflowRunId) => {
  writePlan(workflowRunId);
  turns[0]?.finish();
  await vi.waitFor(async () => expect((await statuses())[0]?.status).toBe('completed'));
};

const heldAutoRunOff = async () => {
  await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
    autoRun: false,
    triggerMode: 'manual',
    rulesSnapshot: PLAN_RULES,
  });
  const workflowRunId = runIdOfSession();
  const planning = useAppStore.getState().activateWorkflowAgent({
    sessionId,
    agentId: agentIdOf('Plan'),
    bypassGate: true,
  });
  await vi.waitFor(() => expect(startedNames()).toEqual(['Plan']));
  await finishPlanStep(workflowRunId);
  await planning;
  await expect(
    useAppStore.getState().activateWorkflowAgent({
      sessionId,
      agentId: agentIdOf('Implement'),
      focus: 'agent',
    }),
  ).rejects.toBeInstanceOf(WorkflowGateError);
  expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('plan-approval');
  return workflowRunId;
};

const heldAutoRunOn = async () => {
  await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
    autoRun: true,
    triggerMode: 'immediate',
    rulesSnapshot: PLAN_RULES,
  });
  await vi.waitFor(() => expect(startedNames()).toEqual(['Plan']));
  const workflowRunId = runIdOfSession();
  await finishPlanStep(workflowRunId);
  await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);
  await vi.waitFor(async () =>
    expect((await storedRun(workflowRunId))?.orchestrationStop?.kind).toBe('plan-approval'),
  );
  return workflowRunId;
};

const approve = (workflowRunId: WorkflowRunId) =>
  useAppStore.getState().approveWorkflowRunPlan(sessionId, workflowRunId);

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('approve a run plan on sqlite', () => {
  it('starts the step that consumes the plan when the run does not run on its own', async () => {
    const workflowRunId = await heldAutoRunOff();

    const result = await approve(workflowRunId);

    expect(result).toEqual({ kind: 'approved', next: 'started', agentId: agentIdOf('Implement') });
    expect(startedNames()).toEqual(['Plan', 'Implement']);
    expect((await statuses()).map((row) => row.status)).toEqual([
      'completed',
      'running',
      'pending',
    ]);
    const stored = await storedRun(workflowRunId);
    expect(stored?.orchestrationStop).toBeUndefined();
    expect(stored?.rulesSnapshot?.planApproved).toBe(true);
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();
    expect(storySpies.addPlanConsumption).toHaveBeenCalledOnce();
    expect(storySpies.addPlanConsumption.mock.calls[0]?.[1]).toBe(agentIdOf('Implement'));
  });

  it('adds no agent beside the three the workflow has', async () => {
    const workflowRunId = await heldAutoRunOff();

    await approve(workflowRunId);

    expect(await statuses()).toHaveLength(3);
  });

  it('answers once the step started, not once it finished', async () => {
    const workflowRunId = await heldAutoRunOff();

    await approve(workflowRunId);

    expect(turns[1]?.agentId).toBe(agentIdOf('Implement'));
    turns[1]?.finish();
    await vi.waitFor(async () => expect((await statuses())[1]?.status).toBe('completed'));
  });

  it('lets a run that runs on its own continue by itself', async () => {
    const workflowRunId = await heldAutoRunOn();

    const result = await approve(workflowRunId);

    expect(result).toEqual({ kind: 'approved', next: 'continues', agentId: null });
    await vi.waitFor(() => expect(startedNames()).toEqual(['Plan', 'Implement']));
    await settle();
    expect(startedNames()).toEqual(['Plan', 'Implement']);
    const stored = await storedRun(workflowRunId);
    expect(stored?.orchestrationStop).toBeUndefined();
    expect(stored?.rulesSnapshot?.planApproved).toBe(true);
  });

  it('turns a second approve into a noop and starts nothing new', async () => {
    const workflowRunId = await heldAutoRunOff();
    await approve(workflowRunId);

    const second = await approve(workflowRunId);

    expect(second).toEqual({ kind: 'noop', reason: 'not-held' });
    await settle();
    expect(startedNames()).toEqual(['Plan', 'Implement']);
  });

  it('starts one step when two approves race', async () => {
    const workflowRunId = await heldAutoRunOff();

    const results = await Promise.all([approve(workflowRunId), approve(workflowRunId)]);

    expect(results.map((result) => result.kind).sort()).toEqual(['approved', 'noop']);
    await settle();
    expect(startedNames()).toEqual(['Plan', 'Implement']);
  });

  it('does nothing for a run that is not held and for a run that is gone', async () => {
    await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
      autoRun: false,
      triggerMode: 'manual',
      rulesSnapshot: PLAN_RULES,
    });
    const workflowRunId = runIdOfSession();

    expect(await approve(workflowRunId)).toEqual({ kind: 'noop', reason: 'not-held' });
    expect(await approve('run-missing' as WorkflowRunId)).toEqual({
      kind: 'noop',
      reason: 'missing-run',
    });
    expect(turns).toHaveLength(0);
    expect((await storedRun(workflowRunId))?.rulesSnapshot?.planApproved).not.toBe(true);
  });

  it('keeps the hold and writes nothing when the snapshot write fails', async () => {
    const workflowRunId = await heldAutoRunOff();
    injectDbFault({ match: /UPDATE session_workflows SET rules_snapshot/, message: 'disk full' });

    const result = await approve(workflowRunId);

    expect(result.kind).toBe('failed');
    expect(result.kind === 'failed' ? result.message : '').toContain('disk full');
    const stored = await storedRun(workflowRunId);
    expect(stored?.orchestrationStop?.kind).toBe('plan-approval');
    expect(stored?.rulesSnapshot?.planApproved).not.toBe(true);
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('plan-approval');
    expect(startedNames()).toEqual(['Plan']);
  });

  it('puts the snapshot back and keeps the hold when clearing the stop fails, and a retry goes through', async () => {
    const workflowRunId = await heldAutoRunOff();
    injectDbFault({
      match: /UPDATE session_workflows SET orchestration_error/,
      message: 'disk full',
    });

    const failed = await approve(workflowRunId);

    expect(failed.kind).toBe('failed');
    const stored = await storedRun(workflowRunId);
    expect(stored?.orchestrationStop?.kind).toBe('plan-approval');
    expect(stored?.rulesSnapshot?.planApproved).not.toBe(true);
    expect(runOf(workflowRunId)?.rulesSnapshot?.planApproved).not.toBe(true);
    expect(startedNames()).toEqual(['Plan']);

    const retried = await approve(workflowRunId);

    expect(retried).toEqual({ kind: 'approved', next: 'started', agentId: agentIdOf('Implement') });
    expect(startedNames()).toEqual(['Plan', 'Implement']);
  });

  it('refuses while the planner is revising the plan and keeps the hold', async () => {
    const workflowRunId = await heldAutoRunOff();
    const plan = aPlan({
      sessionId,
      agentId: agentIdOf('Plan'),
      workflowRunId,
      title: 'Retry with backoff',
    });
    useAppStore.setState({
      sessionPlans: { [sessionId]: [plan] },
      sessionArtifacts: { [sessionId]: [aStoredPlan({ sourceTurnId: 'run-1' }, plan)] },
      agentTurnState: {
        [agentIdOf('Plan')]: {
          kind: 'running',
          runId: 'run-2' as ProviderRunId,
          startedAt: AT,
        },
      },
    });

    const result = await approve(workflowRunId);

    expect(result).toEqual({ kind: 'failed', message: 'The planner is revising this plan' });
    expect((await storedRun(workflowRunId))?.orchestrationStop?.kind).toBe('plan-approval');
    expect(startedNames()).toEqual(['Plan']);
  });

  it('lifts the hold and starts nothing while an open question blocks the run', async () => {
    const workflowRunId = await heldAutoRunOff();
    storySpies.listPlansForSession.mockResolvedValue([]);
    await insertOpenQuestion(storySqlite(), {
      id: 'question-retry-budget' as OpenQuestionId,
      sessionId,
      workflowId: WORKFLOW_ID,
      workflowRunId,
      text: 'Which retry budget?',
      suggestedAnswers: [],
      isBlocking: true,
    });

    const result = await approve(workflowRunId);

    expect(result).toEqual({ kind: 'approved', next: 'continues', agentId: null });
    expect((await storedRun(workflowRunId))?.orchestrationStop).toBeUndefined();
    expect(startedNames()).toEqual(['Plan']);
  });
});
