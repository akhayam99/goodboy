import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSessionById,
  insertAgent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
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
const STEP_NAMES = ['Review', 'Implement', 'Test'] as const;
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

describe('store on sqlite: pausing a run', () => {
  it('starts no turn for a step whose activation was in flight when you paused', async () => {
    const workflowRunId = await attachRun({ autoRun: true });
    let releasePlans: () => void = () => undefined;
    storySpies.listPlansForSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePlans = () => resolve([]);
        }),
    );

    const activation = useAppStore.getState().activateWorkflowAgent({
      sessionId,
      agentId: agentIdOf('Implement'),
      bypassGate: true,
    });
    await vi.waitFor(() => expect(storySpies.listPlansForSession).toHaveBeenCalled());
    await useAppStore.getState().pauseWorkflowRun(sessionId, workflowRunId);
    releasePlans();

    await expect(activation).rejects.toBeInstanceOf(WorkflowGateError);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await statuses()).toEqual([
      { name: 'Review', status: 'pending' },
      { name: 'Implement', status: 'pending' },
      { name: 'Test', status: 'pending' },
    ]);
  });

  it('lets the step in flight finish and starts nothing after it', async () => {
    const workflowRunId = await attachRun({ autoRun: true });
    const review = await startStep('Review');

    await useAppStore.getState().pauseWorkflowRun(sessionId, workflowRunId);
    turns[0]?.finish();
    await review.finished;
    await vi.waitFor(async () =>
      expect((await statuses())[0]).toEqual({ name: 'Review', status: 'completed' }),
    );
    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    expect(startedNames()).toEqual(['Review']);
    expect((await statuses())[1]).toEqual({ name: 'Implement', status: 'pending' });
  });

  it('admits no work from autorun, the step button, a skip or a read-now hint', async () => {
    const workflowRunId = await attachRun({ autoRun: false });
    await useAppStore.getState().pauseWorkflowRun(sessionId, workflowRunId);

    await useAppStore.getState().setWorkflowRunAutoRun(sessionId, workflowRunId, true);
    await expect(
      useAppStore.getState().activateWorkflowAgent({
        sessionId,
        agentId: agentIdOf('Review'),
        bypassGate: true,
      }),
    ).rejects.toBeInstanceOf(WorkflowGateError);
    await useAppStore.getState().skipStuckStepAndAdvance(sessionId, workflowRunId, {
      force: true,
      agentId: agentIdOf('Review'),
    });
    await useAppStore.getState().addWorkflowOrchestratorHint(sessionId, workflowRunId, {
      text: 'Keep the retry budget at three attempts',
      delivery: 'now',
    });

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect((await statuses()).map((row) => row.status)).toEqual(['skipped', 'pending', 'pending']);
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('paused');
  });

  it('keeps the pause across a restart and resumes where it was without touching autonomy', async () => {
    await useAppStore
      .getState()
      .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: true, triggerMode: 'immediate' });
    const workflowRunId = runIdOfSession();
    await vi.waitFor(() => expect(startedNames()).toEqual(['Review']));
    await useAppStore.getState().pauseWorkflowRun(sessionId, workflowRunId);
    turns[0]?.finish();
    await vi.waitFor(async () => expect((await statuses())[0]?.status).toBe('completed'));
    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);
    expect(startedNames()).toEqual(['Review']);

    const reloaded = await getSessionById(storySqlite(), sessionId);
    expect(reloaded?.workflowRuns[0]?.orchestrationStop?.kind).toBe('paused');

    await useAppStore.getState().resumeWorkflowRun(sessionId, workflowRunId);

    await vi.waitFor(() => expect(startedNames()).toEqual(['Review', 'Implement']));
    const resumed = await getSessionById(storySqlite(), sessionId);
    expect(resumed?.workflowRuns[0]?.orchestrationStop).toBeUndefined();
    expect(resumed?.workflowRuns[0]?.autoRun).toBe(true);
  });
});

describe('store on sqlite: skipping a live step', () => {
  it('cancels only that turn, marks it skipped and starts the next step once', async () => {
    const workflowRunId = await attachRun({ autoRun: true });
    const review = await startStep('Review');
    const reviewRun = turns[0]?.runId;

    await useAppStore.getState().skipStuckStepAndAdvance(sessionId, workflowRunId, {
      force: true,
      agentId: agentIdOf('Review'),
    });
    await review.finished;
    await vi.waitFor(() => expect(startedNames()).toEqual(['Review', 'Implement']));
    await useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    expect(storySpies.cancelTurn).toHaveBeenCalledExactlyOnceWith(reviewRun);
    expect(startedNames()).toEqual(['Review', 'Implement']);
    expect((await statuses()).map((row) => row.status)).toEqual(['skipped', 'running', 'pending']);
  });

  it('marks a live step skipped and waits for your go when the run asks before each step', async () => {
    const workflowRunId = await attachRun({ autoRun: false });
    const review = await startStep('Review');

    await useAppStore.getState().skipStuckStepAndAdvance(sessionId, workflowRunId, {
      force: true,
      agentId: agentIdOf('Review'),
    });
    await review.finished;

    expect(startedNames()).toEqual(['Review']);
    expect((await statuses()).map((row) => row.status)).toEqual(['skipped', 'pending', 'pending']);
  });
});
