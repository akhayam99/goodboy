import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertOpenQuestion,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
  saveWorkflow,
} from '@goodboy/db';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@goodboy/core';
import type {
  AgentId,
  IsoDateTime,
  OpenQuestionId,
  ProviderRunId,
  SessionId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import { summarizerQueues } from './slices/turn/turnHelpers';
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
const WORKFLOW_ID = 'workflow-settlement-run' as WorkflowId;
const AT = '2026-10-09T09:00:00.000Z' as IsoDateTime;
const MINUTE = 60_000;
const STEP_DONE = /<<step-done id="([^"]+)">>/;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Orchestrated workflow',
  description: '',
  steps: [],
  origin: 'orchestrated',
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

type AuxPayload = {
  readonly args: { readonly systemPrompt: string };
};

type Turn = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
  readonly finish: () => void;
};

const decisionReply = (text: string) => ({
  stdout: JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: text,
    usage: { input_tokens: 1200, output_tokens: 240 },
  }),
  stderr: '',
  exitCode: 0,
});

const orchestrated = (decision: Readonly<Record<string, unknown>>): string =>
  ['<<orchestrator>>', JSON.stringify(decision), '<</orchestrator>>'].join('\n');

const NEXT_STEP = orchestrated({
  action: 'next',
  reason: 'The settlement code has not been mapped yet.',
  step: {
    name: 'Scout the settlement code',
    role: 'scout',
    promptPrefix: 'Map how ledger-core settles a payment from payments-api.',
  },
});

const DONE = orchestrated({ action: 'done', reason: 'The settlement flow is mapped.' });

let useAppStore: StoryStore;
let sessionId: SessionId;
let turns: Array<Turn>;
let requests: Array<AuxPayload>;
let reply: string;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const fakeProvider = ({
  runId,
  prompt,
}: {
  readonly runId: ProviderRunId;
  readonly prompt: string;
}) => {
  const agentId = (prompt.match(STEP_DONE)?.[1] ?? '') as AgentId;
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  turns.push({ runId, agentId, finish });
  return (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'Mapping the settlement code.\n', at: AT };
    await finished;
    yield { kind: 'assistant_text', runId, delta: `<<step-done id="${agentId}">>`, at: AT };
  })();
};

beforeEach(async () => {
  await resetStoryStore();
  turns = [];
  requests = [];
  reply = NEXT_STEP;
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
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
    planner_run: (payload: AuxPayload) => {
      if (payload.args.systemPrompt !== ORCHESTRATOR_SYSTEM_PROMPT) {
        return { stdout: '', stderr: 'no aux provider in tests', exitCode: 1 };
      }
      requests.push(payload);
      return decisionReply(reply);
    },
  });
  storySpies.invokeWorkflowUpsert.mockImplementation((args) => saveWorkflow(storySqlite(), args));
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
    goal: 'Map how ledger-core settles a payment from payments-api',
  });
  sessionId = session.id as SessionId;
});

afterEach(async () => {
  useAppStore.setState({ summarizerStatus: {} });
  await vi.waitFor(() => {
    for (const turn of turns) {
      turn.finish();
    }
    expect(Object.values(useAppStore.getState().orchestratingWorkflowRuns)).not.toContain(true);
    expect(summarizerQueues.size).toBe(0);
  });
  vi.useRealTimers();
});

const runOf = (workflowRunId: WorkflowRunId) =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === workflowRunId);

const runIdOfSession = (): WorkflowRunId => {
  const run = useAppStore.getState().sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns[0];
  if (run === undefined) {
    throw new Error('the run was not attached');
  }
  return run.id;
};

type AttachParams = {
  readonly triggerMode: 'immediate' | 'manual';
};

const attachRun = async ({ triggerMode }: AttachParams): Promise<WorkflowRunId> => {
  await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
    autoRun: true,
    executionMode: 'dynamic',
    triggerMode,
  });
  return runIdOfSession();
};

type SummarizerStatus = 'running' | 'idle';

const setSummarizer = (status: SummarizerStatus): void => {
  useAppStore.setState((state) => ({
    summarizerStatus: {
      ...state.summarizerStatus,
      [sessionId]: { status, lastUpdate: null, error: null, lastUsage: null, lastAttempt: null },
    },
  }));
};

const runAgents = async (workflowRunId: WorkflowRunId) =>
  rowsOf<{ name: string; status: string }>({
    sql: 'SELECT name, status FROM agents WHERE workflow_run_id = ? ORDER BY ordinal',
    params: [workflowRunId],
  });

const storedStopKind = (workflowRunId: WorkflowRunId) =>
  runOf(workflowRunId)?.orchestrationStop?.kind;

const storedStop = async (workflowRunId: WorkflowRunId) =>
  rowsOf<{ orchestration_stop_kind: string; orchestration_error: string | null }>({
    sql: 'SELECT orchestration_stop_kind, orchestration_error FROM session_workflows WHERE workflow_run_id = ?',
    params: [workflowRunId],
  });

describe('an orchestrated run and the session summarizer', () => {
  it('asks the orchestrator at once while the summarizer is still writing', async () => {
    setSummarizer('running');

    await attachRun({ triggerMode: 'immediate' });

    await vi.waitFor(() => expect(requests).toHaveLength(1));
  });

  it('holds the step it chose until the summarizer is done, then starts it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setSummarizer('running');
    const workflowRunId = await attachRun({ triggerMode: 'immediate' });
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(await runAgents(workflowRunId)).toEqual([]);
    expect(turns).toHaveLength(0);

    setSummarizer('idle');
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(turns).toHaveLength(1));

    expect(await runAgents(workflowRunId)).toEqual([
      { name: 'Scout the settlement code', status: 'running' },
    ]);
  });

  it('gives up on a summarizer that never settles after sixty seconds, not later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    reply = DONE;
    setSummarizer('running');
    const workflowRunId = await attachRun({ triggerMode: 'immediate' });
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(59_000);
    expect(runOf(workflowRunId)?.orchestrationOutcome).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(runOf(workflowRunId)?.orchestrationOutcome).toBe('done'));
  });

  it('holds a done outcome until the summarizer is done', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    reply = DONE;
    setSummarizer('running');
    const workflowRunId = await attachRun({ triggerMode: 'immediate' });
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(runOf(workflowRunId)?.orchestrationOutcome).toBeUndefined();

    setSummarizer('idle');
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(runOf(workflowRunId)?.orchestrationOutcome).toBe('done'));
  });

  it('stops reading as deciding once the step it chose is running', async () => {
    const workflowRunId = await attachRun({ triggerMode: 'immediate' });

    await vi.waitFor(() => expect(turns).toHaveLength(1));

    expect(useAppStore.getState().orchestratingWorkflowRuns[workflowRunId]).toBe(false);
  });

  it('says so when the step the orchestrator chose cannot be created', async () => {
    storySpies.invokeAgentInsert.mockRejectedValueOnce(new Error('the agents table is locked'));

    const workflowRunId = await attachRun({ triggerMode: 'immediate' });

    await vi.waitFor(() => expect(storedStopKind(workflowRunId)).toBe('failure'));
    expect(runOf(workflowRunId)?.orchestrationStop?.message).toContain(
      'the agents table is locked',
    );
    expect(await storedStop(workflowRunId)).toEqual([
      expect.objectContaining({ orchestration_stop_kind: 'failure' }),
    ]);
    expect(await runAgents(workflowRunId)).toEqual([]);
    await vi.waitFor(async () =>
      expect(
        await rowsOf<{ title: string }>({
          sql: 'SELECT title FROM notifications WHERE session_id = ?',
          params: [sessionId],
        }),
      ).toEqual([{ title: 'The orchestrator could not start the next step' }]),
    );
  });

  it('lets a forced skip past the summarizer', async () => {
    setSummarizer('running');
    const workflowRunId = await attachRun({ triggerMode: 'manual' });

    void useAppStore.getState().orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });

    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(await runAgents(workflowRunId)).toHaveLength(1);
  });

  it('decides the step after a finished one without waiting on the summarizer first', async () => {
    const workflowRunId = await attachRun({ triggerMode: 'manual' });
    void useAppStore.getState().orchestrateNextStep(sessionId, workflowRunId);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0]?.finish();
    await vi.waitFor(async () =>
      expect(await runAgents(workflowRunId)).toEqual([
        { name: 'Scout the settlement code', status: 'completed' },
      ]),
    );
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              workflowRuns: candidate.workflowRuns.map((run) => ({
                ...run,
                triggerMode: 'immediate' as const,
              })),
            }
          : candidate,
      ),
    }));
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    setSummarizer('running');

    void useAppStore.getState().maybeAutoAdvanceWorkflow(sessionId);

    await vi.waitFor(() => expect(requests).toHaveLength(2));
  });
});

describe('an orchestrated run that waited on an answer', () => {
  it('asks the orchestrator for the next step even when no agent could take the answer', async () => {
    const workflowRunId = await attachRun({ triggerMode: 'manual' });
    void useAppStore.getState().orchestrateNextStep(sessionId, workflowRunId);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0]?.finish();
    await vi.waitFor(async () =>
      expect(await runAgents(workflowRunId)).toEqual([
        { name: 'Scout the settlement code', status: 'completed' },
      ]),
    );
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              workflowRuns: candidate.workflowRuns.map((run) => ({
                ...run,
                triggerMode: 'immediate' as const,
              })),
            }
          : candidate,
      ),
    }));
    await insertOpenQuestion(storySqlite(), {
      id: 'question-settlement-alias' as OpenQuestionId,
      sessionId,
      workflowRunId,
      text: 'Keep the legacy settlement route as an alias?',
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(sessionId);
    const decisions = requests.length;

    const answering = useAppStore.getState().answerOpenQuestions(
      sessionId,
      [
        {
          id: 'question-settlement-alias' as OpenQuestionId,
          text: 'Keep the legacy settlement route as an alias?',
          answer: 'Keep it',
        },
      ],
      null,
    );

    await expect(answering).rejects.toThrow('no agent selected');
    await vi.waitFor(() => expect(requests).toHaveLength(decisions + 1));
  });
});

describe('the watchdog over an orchestrated run', () => {
  const waking = async (): Promise<WorkflowRunId> => {
    const workflowRunId = await attachRun({ triggerMode: 'manual' });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              workflowRuns: candidate.workflowRuns.map((run) => ({
                ...run,
                triggerMode: 'immediate' as const,
              })),
            }
          : candidate,
      ),
    }));
    return workflowRunId;
  };

  it('wakes a run that never got its first step once it has sat idle for twenty seconds', async () => {
    const workflowRunId = await waking();
    const t0 = Date.now();

    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 });
    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + 10_000 });
    expect(requests).toHaveLength(0);

    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + 21_000 });

    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await vi.waitFor(async () => expect(await runAgents(workflowRunId)).toHaveLength(1));
  });

  it('leaves a run alone while a decision is in flight', async () => {
    const workflowRunId = await waking();
    useAppStore.setState({ orchestratingWorkflowRuns: { [workflowRunId]: true } });
    const t0 = Date.now();

    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 });
    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + 10 * MINUTE });

    expect(requests).toHaveLength(0);
    useAppStore.setState({ orchestratingWorkflowRuns: {} });
  });

  it('leaves a run alone while it waits on an answer from you', async () => {
    const workflowRunId = await waking();
    await insertOpenQuestion(storySqlite(), {
      id: 'question-settlement-alias' as OpenQuestionId,
      sessionId,
      workflowRunId,
      text: 'Keep the legacy settlement route as an alias?',
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(sessionId);
    const t0 = Date.now();

    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 });
    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + 10 * MINUTE });

    expect(requests).toHaveLength(0);
  });

  it('wakes the run once the answer it waited on is in', async () => {
    const workflowRunId = await waking();
    await insertOpenQuestion(storySqlite(), {
      id: 'question-settlement-alias' as OpenQuestionId,
      sessionId,
      workflowRunId,
      text: 'Keep the legacy settlement route as an alias?',
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(sessionId);
    const t0 = Date.now();
    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 });
    await storySqlite().execute("UPDATE open_questions SET status = 'answered', user_answer = ?", [
      'Keep it',
    ]);
    await useAppStore.getState().loadSessionOpenQuestions(sessionId);

    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + MINUTE });
    expect(requests).toHaveLength(0);
    await useAppStore.getState().sweepIdleRuns({ nowMs: t0 + 2 * MINUTE });

    await vi.waitFor(() => expect(requests).toHaveLength(1));
  });

  it('asks at most once per interval and tells you when nothing picked the run up', async () => {
    const workflowRunId = await waking();
    const wake = vi.fn(async () => undefined);
    useAppStore.setState({ maybeAutoAdvanceWorkflow: wake });
    const t0 = Date.now();
    const sweepAt = (offsetMs: number) =>
      useAppStore.getState().sweepIdleRuns({ nowMs: t0 + offsetMs });

    await sweepAt(0);
    await sweepAt(10_000);
    expect(wake).not.toHaveBeenCalled();
    await sweepAt(21_000);
    await sweepAt(60_000);
    await sweepAt(100_000);
    expect(wake).toHaveBeenCalledTimes(1);

    await sweepAt(112_000);
    await sweepAt(202_000);
    expect(wake).toHaveBeenCalledTimes(3);
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();

    await sweepAt(291_000);
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();
    await sweepAt(293_000);
    expect(wake).toHaveBeenCalledTimes(3);

    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('failure');
    expect(await storedStop(workflowRunId)).toEqual([
      expect.objectContaining({ orchestration_stop_kind: 'failure' }),
    ]);
    await sweepAt(500_000);
    expect(wake).toHaveBeenCalledTimes(3);
  });
});
