import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type ProviderRunId,
  type SessionId,
  type StepId,
  type TurnEvent,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
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

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-settlement-export' });
const STEP_ID = brandId<StepId>({ value: 'step-implement' });
const AT = brandId<IsoDateTime>({ value: '2026-10-30T09:00:00.000Z' });
const NUDGE = 'You stopped before finishing this workflow step.';
const ANSWERS_HEADER = 'Answers to open questions';

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settlement export for ledger-core',
  description: '',
  steps: [
    {
      id: STEP_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Implement',
      promptPrefix: 'Implement the settlement export',
    },
  ],
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

const askBlocking = (text: string): string =>
  `<<ctx-question blocking="true" suggestions="Skip them|Include them" recommended="Skip them" select="one">>${text}<</ctx-question>>`;

const FIRST_ASK = askBlocking('Should the export skip deliveries older than seven days?');
const SECOND_ASK = askBlocking('Skip deliveries older than seven days in the export?');
const THIRD_ASK = askBlocking('Do you want old deliveries left out of the export?');

type RunArgs = { readonly runId: ProviderRunId; readonly prompt: string };

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;
let prompts: Array<string>;
let replies: Array<string>;
let sentContents: Array<string>;
let finalizations: Array<Promise<unknown>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const scriptedProvider = ({ runId, prompt }: RunArgs) => {
  prompts.push(prompt);
  const text = replies.shift() ?? 'Still working through the export.';
  return (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: text, at: AT };
  })();
};

beforeEach(async () => {
  await resetStoryStore();
  prompts = [];
  replies = [];
  sentContents = [];
  finalizations = [];
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
  storySpies.invokeAgentList.mockImplementation(async () => [
    ...((await listAgentsForSessions(storySqlite(), [sessionId])).get(sessionId) ?? []),
  ]);
  storySpies.invokeAgentUpdateStatus.mockImplementation((id: AgentId, fields) =>
    recordAgentStatus(storySqlite(), id, fields),
  );
  storySpies.runTurn.mockImplementation(scriptedProvider);
  const sendTurn = useAppStore.getState().sendTurn;
  const finalizeWorkflowStep = useAppStore.getState().finalizeWorkflowStep;
  useAppStore.setState({
    sendTurn: (params) => {
      sentContents.push(params.content);
      return sendTurn(params);
    },
    finalizeWorkflowStep: (...args) => {
      const finalized = finalizeWorkflowStep(...args);
      finalizations.push(finalized);
      return finalized;
    },
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Export settlements from ledger-core',
  });
  sessionId = session.id;
  await useAppStore
    .getState()
    .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: true, triggerMode: 'manual' });
  const agent = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.name === 'Implement',
  );
  if (agent === undefined) {
    throw new Error('no Implement agent');
  }
  agentId = agent.id;
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const openQuestions = (): ReadonlyArray<OpenQuestion> =>
  useAppStore.getState().sessionOpenQuestions[sessionId] ?? [];

const runStep = async (): Promise<void> => {
  await useAppStore.getState().activateWorkflowAgent({ sessionId, agentId, bypassGate: true });
};

const keepGoing = async (): Promise<void> => {
  await useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Keep going.',
    origin: 'operator',
  });
};

const nudges = (): number => sentContents.filter((content) => content.includes(NUDGE)).length;

const finalizedTurns = async (count: number): Promise<void> => {
  await vi.waitFor(() => expect(finalizations).toHaveLength(count));
  await Promise.all(finalizations);
};

const answer = async (question: OpenQuestion, text: string): Promise<void> => {
  await useAppStore
    .getState()
    .answerOpenQuestions(
      sessionId,
      [{ id: question.id, text: question.text, answer: text }],
      agentId,
    );
};

describe('an orchestrated step that asks a blocking question', () => {
  it('is nudged to continue when it stops with nothing to answer', async () => {
    replies = ['Working on the settlement export.'];

    await runStep();

    await vi.waitFor(() => expect(nudges()).toBe(1));
  });

  it('is not nudged when the operator says keep going while its question is still open', async () => {
    replies = [FIRST_ASK, 'I am waiting for the answer.'];
    await runStep();
    await vi.waitFor(() => expect(openQuestions()).toHaveLength(1));

    await keepGoing();
    await finalizedTurns(2);

    expect(prompts).toHaveLength(2);
    expect(nudges()).toBe(0);
    expect(openQuestions()).toHaveLength(1);
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
  });

  it('ends with one open question when the agent asks it again, and answering it sends the turn', async () => {
    replies = [FIRST_ASK, SECOND_ASK, THIRD_ASK];
    await runStep();
    await vi.waitFor(() => expect(openQuestions()).toHaveLength(1));
    await keepGoing();
    await vi.waitFor(() =>
      expect(openQuestions().map((question) => question.text)).toEqual([
        'Skip deliveries older than seven days in the export?',
      ]),
    );
    await keepGoing();
    await vi.waitFor(() =>
      expect(openQuestions().map((question) => question.text)).toEqual([
        'Do you want old deliveries left out of the export?',
      ]),
    );

    const settled = await rowsOf<{ user_answer: string; answer_delivered_at: number | null }>({
      sql: "SELECT user_answer, answer_delivered_at FROM open_questions WHERE session_id = ? AND status = 'answered'",
      params: [sessionId],
    });
    expect(settled).toHaveLength(2);
    expect(settled.every((row) => row.user_answer === '[resolved by agent]')).toBe(true);
    expect(settled.every((row) => row.answer_delivered_at !== null)).toBe(true);
    await finalizedTurns(3);
    expect(nudges()).toBe(0);
    const turnsBefore = prompts.length;
    const latest = openQuestions()[0];
    if (latest === undefined) {
      throw new Error('no open question');
    }

    await answer(latest, 'Skip them');

    expect(prompts).toHaveLength(turnsBefore + 1);
    const delivered = prompts[turnsBefore] ?? '';
    expect(delivered).toContain(ANSWERS_HEADER);
    expect(delivered).toContain('Do you want old deliveries left out of the export?');
    expect(delivered).toContain('A: Skip them');
    expect(delivered).not.toContain('Should the export skip deliveries older than seven days?');
    expect(openQuestions()).toHaveLength(0);
  });

  it('needs both answers when it asks two different questions in one turn', async () => {
    replies = [`${FIRST_ASK}${askBlocking('Which Northwind account owns the retries?')}`];
    await runStep();
    await vi.waitFor(() => expect(openQuestions()).toHaveLength(2));
    const [first, second] = openQuestions();
    if (first === undefined || second === undefined) {
      throw new Error('expected two open questions');
    }
    const turnsBefore = prompts.length;

    await answer(first, 'Skip them');
    expect(prompts).toHaveLength(turnsBefore);
    expect(openQuestions()).toHaveLength(1);

    await answer(second, 'Northwind payments');
    expect(prompts).toHaveLength(turnsBefore + 1);
    const delivered = prompts[turnsBefore] ?? '';
    expect(delivered).toContain('A: Skip them');
    expect(delivered).toContain('A: Northwind payments');
  });
});
