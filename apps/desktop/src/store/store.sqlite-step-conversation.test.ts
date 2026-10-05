import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentHandoff,
  insertAgent,
  insertDiffComment,
  insertWorkspace,
  listAgentsForSessions,
  listTurnEventsForAgent,
  recordAgentStatus,
} from '@goodboy/db';
import { wrapOpenQuestionAnswers } from '@goodboy/core';
import type {
  AgentId,
  IsoDateTime,
  ProjectId,
  ProviderRunId,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { SendTurnResult } from './slices/turn/types';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import type { ProviderDisplayInfo } from '../features/providers/providers';
import { reduceTranscript } from '../features/chat/utils/transcript-items';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { recordOrchestratorUsage } from './slices/workflows/recordOrchestratorUsage';
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
vi.mock('../features/chat/turn', async () => {
  const actual =
    await vi.importActual<typeof import('../features/chat/turn')>('../features/chat/turn');
  return {
    ...(await import('./storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
    decodeCliTooOldMessage: actual.decodeCliTooOldMessage,
  };
});
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
const WORKFLOW_ID = 'workflow-settle-batches' as WorkflowId;
const STEP_NAMES = ['Plan', 'Review'] as const;
const STEP_ROLES = ['planner', 'reviewer'] as const;
const AT = '2026-10-05T11:55:00.000Z' as IsoDateTime;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settle batches through ledger-core',
  description: '',
  steps: STEP_NAMES.map((name, ordinal) => ({
    id: `step-settle-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    role: STEP_ROLES[ordinal],
    promptPrefix: `${name} the batch settlement in ledger-core`,
  })),
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

const STATUS_REPLY = [
  'No, the pull request was not created. The branch `nw/settle-batches` is local only: nothing was pushed, because the earlier steps were waiting for your confirmation.',
  '',
  'I am read-only in this review, so I cannot push or open the pull request. I hand the work to an implementer that opens it as a draft.',
].join('\n');

const PROSE_ASK = 'Tests are green.\n\nShall I push the branch and open the pull request now?';

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const replyWith = (text: string) => {
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield { kind: 'assistant_text', runId, delta: text, at: AT };
    })(),
  );
};

beforeEach(async () => {
  await resetStoryStore();
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
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Settle batches through ledger-core',
  });
  sessionId = session.id as SessionId;
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const attachRun = async (): Promise<WorkflowRunId> => {
  await useAppStore
    .getState()
    .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: false, triggerMode: 'manual' });
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

const runStep = (name: (typeof STEP_NAMES)[number]) =>
  useAppStore
    .getState()
    .activateWorkflowAgent({ sessionId, agentId: agentIdOf(name), bypassGate: true });

const transcriptOf = (agentId: AgentId) => useAppStore.getState().transcripts[agentId] ?? [];

const openQuestionTexts = async () =>
  (
    await rowsOf<{ text: string; is_blocking: number }>({
      sql: 'SELECT text, is_blocking FROM open_questions WHERE session_id = ? AND status = ?',
      params: [sessionId, 'open'],
    })
  ).map((row) => row.text);

const chargeOrchestratorDecision = ({
  agentId,
  workflowRunId,
}: {
  readonly agentId: AgentId;
  readonly workflowRunId: WorkflowRunId;
}) =>
  recordOrchestratorUsage({
    set: useAppStore.setState,
    get: useAppStore.getState,
    sessionId,
    agentId,
    workflowRunId,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    usage: {
      inputTokens: 4200,
      outputTokens: 310,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
      estimatedCostUsd: 0.02,
    },
  });

describe('store on sqlite: the first message of a workflow step', () => {
  it('stores the handoff of a step whose orchestrator decision was charged to it', async () => {
    const workflowRunId = await attachRun();
    const agentId = agentIdOf('Plan');
    useAppStore.getState().appendTurnEvent(agentId, sessionId, {
      kind: 'orchestrator_decision',
      runId: 'orchestrator' as ProviderRunId,
      action: 'next',
      reason: 'The earlier step changed the rounding, so the plan has to follow it.',
      stepName: 'Plan',
      at: AT,
    });
    await chargeOrchestratorDecision({ agentId, workflowRunId });
    replyWith('Plan ready.');

    await runStep('Plan');

    const stored = await getAgentHandoff({ db: storySqlite(), agentId });
    expect(stored?.sender).toMatchObject({ kind: 'workflowStep', stepOrdinal: 1 });
    const firstMessage = transcriptOf(agentId).find((event) => event.kind === 'user_text');
    expect(firstMessage).toMatchObject({ handoffId: agentId });
    const item = reduceTranscript(transcriptOf(agentId)).find((entry) => entry.kind === 'handoff');
    expect(item).toMatchObject({ kind: 'handoff', handoffId: agentId });
    await vi.waitFor(async () => {
      const [row] = await rowsOf<{ payload: string }>({
        sql: "SELECT payload FROM turn_events WHERE agent_id = ? AND json_extract(payload, '$.kind') = 'user_text'",
        params: [agentId],
      });
      expect(JSON.parse(row?.payload ?? '{}')).toMatchObject({ handoffId: agentId });
    });
  });

  it('leaves a message to an agent that already ran as a plain message', async () => {
    await attachRun();
    const agentId = agentIdOf('Plan');
    replyWith('Plan ready.');
    await runStep('Plan');
    replyWith('Noted.');

    await useAppStore.getState().sendTurn({ sessionId, agentId, content: 'Use two decimals.' });

    const userTexts = transcriptOf(agentId).filter((event) => event.kind === 'user_text');
    expect(userTexts).toHaveLength(2);
    expect(userTexts[1]).not.toHaveProperty('handoffId');
    const stored = await rowsOf<{ agent_id: string }>({
      sql: 'SELECT agent_id FROM agent_handoffs WHERE agent_id = ?',
      params: [agentId],
    });
    expect(stored).toHaveLength(1);
  });
});

const completePlanStep = async () => {
  const planId = agentIdOf('Plan');
  replyWith(`Plan ready.<<step-done id="${planId}">>`);
  await runStep('Plan');
  await vi.waitFor(async () =>
    expect(
      (
        await rowsOf<{ status: string }>({
          sql: 'SELECT status FROM agents WHERE id = ?',
          params: [planId],
        })
      )[0]?.status,
    ).toBe('completed'),
  );
};

const cursorProvider: ProviderDisplayInfo = {
  id: 'cursor',
  binary: 'cursor-agent',
  label: 'Cursor',
  docsUrl: 'https://docs.harborline.test',
  error: null,
  connection: 'connected',
  version: '9.9.9',
  identity: 'mara@harborline.test',
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
};

const connectCursor = () =>
  useAppStore.setState({
    providers: [...useAppStore.getState().providers, cursorProvider],
  });

const nextTurnFailsOnCursor = async () => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValueOnce({
    selectedProvider: 'cursor',
    selectedModel: 'composer-2.5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.runTurn.mockImplementationOnce(async function* failing(): AsyncIterable<TurnEvent> {
    throw new Error('Cursor is not signed in');
  });
};

describe('store on sqlite: a step that falls back to another provider', () => {
  it('writes one step transition for the turn that ran twice', async () => {
    await attachRun();
    await completePlanStep();
    connectCursor();
    await nextTurnFailsOnCursor();
    replyWith('Review done.');
    const reviewId = agentIdOf('Review');

    await runStep('Review');

    const kinds = transcriptOf(reviewId).map((event) => event.kind);
    expect(kinds.filter((kind) => kind === 'step_transition')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'decision_note')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'user_text')).toHaveLength(1);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(3);
  });

  it('reads back from the database as one first message, one step and one notice', async () => {
    await attachRun();
    await completePlanStep();
    connectCursor();
    const reviewId = agentIdOf('Review');
    await nextTurnFailsOnCursor();
    replyWith('Not created yet.');
    await runStep('Review');
    await nextTurnFailsOnCursor();
    replyWith('Reviewed.');

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId: reviewId,
      content: wrapOpenQuestionAnswers(
        'Answers to open questions:\n\n- Q: Push now?\n  A: Not yet',
      ),
    });

    await vi.waitFor(async () => {
      const stored = await listTurnEventsForAgent(storySqlite(), reviewId);
      expect(
        stored.some((event) => event.kind === 'assistant_text' && event.delta === 'Reviewed.'),
      ).toBe(true);
    });
    const items = reduceTranscript(await listTurnEventsForAgent(storySqlite(), reviewId));
    const kinds = items.map((item) => item.kind);
    expect(kinds.filter((kind) => kind === 'handoff')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'step_transition')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'auth_required')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'decision_note')).toHaveLength(1);
    expect(items.find((item) => item.kind === 'handoff')).toMatchObject({ handoffId: reviewId });
  });
});

describe('store on sqlite: a reply to a question that is not an answer', () => {
  const REPLY = 'Not that one, I left a note on a line of the diff.';

  const holdOnProseQuestion = async () => {
    await attachRun();
    replyWith(PROSE_ASK);
    await runStep('Review');
    const [question] = useAppStore.getState().sessionOpenQuestions[sessionId] ?? [];
    if (question === undefined) {
      throw new Error('the step did not hold on a question');
    }
    return question;
  };

  it('goes to the asking agent as a plain message and closes the blocking question', async () => {
    const question = await holdOnProseQuestion();
    expect(question.isBlocking).toBe(true);
    const reviewId = agentIdOf('Review');
    replyWith('Understood, the note stays on the branch.');

    await useAppStore
      .getState()
      .sendQuestionAsMessage({ sessionId, question, text: `  ${REPLY}  ` });

    expect(
      await rowsOf<{ status: string }>({
        sql: 'SELECT status FROM open_questions WHERE id = ?',
        params: [question.id],
      }),
    ).toEqual([{ status: 'dismissed' }]);
    const userTexts = transcriptOf(reviewId).filter((event) => event.kind === 'user_text');
    expect(userTexts.at(-1)).toMatchObject({ text: REPLY });
    expect(userTexts.at(-1)).not.toHaveProperty('handoffId');
    expect(storySpies.runTurn.mock.calls.at(-1)?.[0]?.prompt).toContain(REPLY);
    expect(storySpies.runTurn.mock.calls.at(-1)?.[0]?.prompt).not.toContain('<<oq-answers>>');
  });

  it('ignores an empty message and leaves the question open', async () => {
    const question = await holdOnProseQuestion();

    await useAppStore.getState().sendQuestionAsMessage({ sessionId, question, text: '   ' });

    expect(await openQuestionTexts()).toEqual([question.text]);
  });

  it.each([
    ['the session budget blocks the turn', { blockedOverBudget: true }, 'budget'],
    [
      'another agent holds the folder',
      { blockedOverBudget: false, isWriterLeaseDenied: true },
      'writing in this folder',
    ],
  ] satisfies ReadonlyArray<readonly [string, SendTurnResult, string]>)(
    'keeps the question open and says why when %s',
    async (_label, refusal, reason) => {
      const question = await holdOnProseQuestion();
      const realSendTurn = useAppStore.getState().sendTurn;
      useAppStore.setState({ sendTurn: vi.fn(async (): Promise<SendTurnResult> => refusal) });

      try {
        const isSent = await useAppStore
          .getState()
          .sendQuestionAsMessage({ sessionId, question, text: REPLY });

        expect(isSent).toBe(false);
        expect(await openQuestionTexts()).toEqual([question.text]);
        expect(
          useAppStore.getState().notifications.some((entry) => entry.body?.includes(reason)),
        ).toBe(true);
      } finally {
        useAppStore.setState({ sendTurn: realSendTurn });
      }
    },
  );

  it('keeps the question open when the turn throws', async () => {
    const question = await holdOnProseQuestion();
    const realSendTurn = useAppStore.getState().sendTurn;
    useAppStore.setState({
      sendTurn: vi.fn(async (): Promise<SendTurnResult> => {
        throw new Error('provider offline');
      }),
    });

    try {
      const isSent = await useAppStore
        .getState()
        .sendQuestionAsMessage({ sessionId, question, text: REPLY });

      expect(isSent).toBe(false);
      expect(await openQuestionTexts()).toEqual([question.text]);
    } finally {
      useAppStore.setState({ sendTurn: realSendTurn });
    }
  });

  it('keeps a note left on a line out of the answer to the question', async () => {
    const question = await holdOnProseQuestion();
    await insertDiffComment(
      storySqlite(),
      'note-settle-1',
      sessionId,
      'src/ledger/settle.ts',
      'Rebuild this from the intro question instead.',
      { side: 'new', lineNumber: 111, endLineNumber: 122 },
      undefined,
      { projectId: 'project-ledger-core' as ProjectId, branch: 'nw/settle-batches' },
    );
    replyWith('Understood.');

    await useAppStore.getState().sendQuestionAsMessage({ sessionId, question, text: REPLY });

    const stored = await rowsOf<{ status: string; consumed_by_agent_id: string | null }>({
      sql: 'SELECT status, consumed_by_agent_id FROM diff_comments WHERE session_id = ?',
      params: [sessionId],
    });
    expect(stored).toEqual([{ status: 'open', consumed_by_agent_id: null }]);
    expect(storySpies.runTurn.mock.calls.at(-1)?.[0]?.prompt).not.toContain('src/ledger/settle.ts');
  });
});

describe('store on sqlite: a step reply that is prose', () => {
  it('does not turn a status reply into an open question', async () => {
    await attachRun();
    replyWith(STATUS_REPLY);

    await runStep('Review');

    expect(await openQuestionTexts()).toEqual([]);
  });

  it('still holds the step on a question the agent asks in prose', async () => {
    await attachRun();
    replyWith(PROSE_ASK);

    await runStep('Review');

    expect(await openQuestionTexts()).toEqual([
      'Shall I push the branch and open the pull request now?',
    ]);
  });
});
