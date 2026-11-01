// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachWorkflowToSession,
  insertOpenQuestion,
  insertSession,
  insertWorkspace,
  markOpenQuestionAnswered,
  updateWorkflowRunOrchestrationStop,
} from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type OpenQuestionId,
  type PlanChangeRequest,
  type WorkflowId,
  type WorkflowOrchestrationStop,
  type WorkflowRules,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-harborline-refunds' });
let RUN_A = brandId<WorkflowRunId>({ value: 'run-harborline-a' });
let RUN_B = brandId<WorkflowRunId>({ value: 'run-harborline-b' });
let runCount = 0;
const NOW = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
let SESSION = aSession({ workspaceId: WORKSPACE_ID, goal: 'Refund batches in ledger-core' });

const HELD_ID = brandId<OpenQuestionId>({ value: 'question-held-a' });
const HELD_TEXT = 'Should refunds older than 90 days be batched?';
const HELD_ANSWER = 'Batch them';
const OTHER_ID = brandId<OpenQuestionId>({ value: 'question-held-b' });
const OTHER_TEXT = 'Which batch size should payments-api use?';
const OTHER_ANSWER = '500 rows';
const ORDINARY_ID = brandId<OpenQuestionId>({ value: 'question-ordinary' });
const ORDINARY_TEXT = 'Keep the legacy settlement route as an alias?';
const ORDINARY_ANSWER = 'Keep it';

const BUDGET_STOP: WorkflowOrchestrationStop = { kind: 'budget', message: 'Paused at the limit' };
const PAUSED_STOP: WorkflowOrchestrationStop = { kind: 'paused', message: 'Paused by you' };
const FAILURE_STOP: WorkflowOrchestrationStop = { kind: 'failure', message: 'boom' };
const PRESET_STOP: WorkflowOrchestrationStop = {
  kind: 'preset-change',
  message: 'Auto wants to add a step',
};

const ADDED: PlanChangeRequest = {
  kind: 'added',
  step: 'Fix the billing table',
  reason: 'The billing table scrolls sideways at 390px',
};

const PRESET_RULES: WorkflowRules = {
  ...DEFAULT_WORKFLOW_RULES,
  route: {
    shape: 'plan',
    row: 2,
    presetName: 'Fix a layout',
    closeness: 'follow',
    role: null,
    choice: 'Workflow · Preset Fix a layout · Follow it',
    why: 'Your ask matches the preset',
  },
  preset: {
    workflowId: 'workflow-layout',
    name: 'Fix a layout',
    steps: [
      {
        name: 'Find',
        role: 'scout',
        promptPrefix: 'Find the widths.',
        isPinned: false,
        routingLock: null,
      },
    ],
  },
  pendingChange: ADDED,
};

type SendTurn = StoryStore['getState'] extends () => infer State
  ? State extends { readonly sendTurn: infer Fn }
    ? Fn
    : never
  : never;

type Deferred = {
  readonly promise: Promise<void>;
  readonly release: () => void;
};

type RunSeed = {
  readonly id: WorkflowRunId;
  readonly stop?: WorkflowOrchestrationStop;
  readonly rules?: WorkflowRules;
  readonly spendLimitUsd?: number;
};

type HoldParams = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly answer: string;
  readonly runId: WorkflowRunId | null;
};

type SeedParams = {
  readonly runs: ReadonlyArray<RunSeed>;
};

let useAppStore: StoryStore;
let log: Array<string>;
let sendTurn: ReturnType<typeof vi.fn<SendTurn>>;
let plannerRun: ReturnType<typeof vi.fn>;

const deferred = (): Deferred => {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

const hold = async ({ id, text, answer, runId }: HoldParams): Promise<void> => {
  await insertOpenQuestion(storySqlite(), {
    id,
    sessionId: SESSION.id,
    ...(runId !== null && { workflowRunId: runId }),
    text,
    suggestedAnswers: [],
    isBlocking: true,
  });
  await markOpenQuestionAnswered(storySqlite(), id, answer);
};

const seed = async ({ runs }: SeedParams): Promise<void> => {
  const db = storySqlite();
  const stateRuns: Array<WorkflowRun> = [];
  for (const [index, seeded] of runs.entries()) {
    await attachWorkflowToSession({
      db,
      sessionId: SESSION.id,
      workflowRunId: seeded.id,
      workflowId: WORKFLOW_ID,
      autoRun: true,
      updatedAt: NOW,
      executionMode: 'dynamic',
      ...(seeded.rules !== undefined && { rulesSnapshot: seeded.rules }),
    });
    if (seeded.stop !== undefined) {
      await updateWorkflowRunOrchestrationStop(db, seeded.id, seeded.stop);
    }
    stateRuns.push(
      aWorkflowRun({
        id: seeded.id,
        workflowId: WORKFLOW_ID,
        executionMode: 'dynamic',
        autoRun: true,
        ordinal: index,
        ...(seeded.stop !== undefined && { orchestrationStop: seeded.stop }),
        ...(seeded.rules !== undefined && { rulesSnapshot: seeded.rules }),
        ...(seeded.spendLimitUsd !== undefined && { spendLimitUsd: seeded.spendLimitUsd }),
      }),
    );
  }
  useAppStore.setState({
    sessions: [{ ...SESSION, workflowRuns: stateRuns }],
    phaseTemplates: {
      [WORKSPACE_ID]: [
        {
          id: WORKFLOW_ID,
          workspaceId: WORKSPACE_ID,
          name: 'Refund batches',
          description: 'Refund batches in ledger-core',
          steps: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
  });
};

const runOf = ({ id }: { readonly id: WorkflowRunId }): WorkflowRun | undefined =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === SESSION.id)
    ?.workflowRuns.find((run) => run.id === id);

const patchRun = ({
  id,
  patch,
}: {
  readonly id: WorkflowRunId;
  readonly patch: Partial<WorkflowRun>;
}): void => {
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) => ({
      ...session,
      workflowRuns: session.workflowRuns.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    })),
  }));
};

const deliveredIds = async (): Promise<ReadonlyArray<string>> =>
  (
    await storySqlite().select<{ id: string }>(
      'SELECT id FROM open_questions WHERE answer_delivered_at IS NOT NULL ORDER BY id',
    )
  ).map((row) => row.id);

const sentContents = (): ReadonlyArray<string> => sendTurn.mock.calls.map(([turn]) => turn.content);

const pending = () => useAppStore.getState().pendingOpenQuestionDeliveries[SESSION.id];

const SENT_OK = { blockedOverBudget: false, isAlreadySent: false };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  runCount += 1;
  RUN_A = brandId<WorkflowRunId>({ value: `run-harborline-a-${runCount}` });
  RUN_B = brandId<WorkflowRunId>({ value: `run-harborline-b-${runCount}` });
  SESSION = aSession({ workspaceId: WORKSPACE_ID, goal: 'Refund batches in ledger-core' });
  log = [];
  plannerRun = vi.fn(async () => {
    log.push('planner');
    throw new Error('ledger-core planner is offline');
  });
  stubStoryInvoke({ workspaces_with_unread: [], planner_run: plannerRun, planner_cancel: null });
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, SESSION);
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, 'Refund batches'],
  );
  sendTurn = vi.fn<SendTurn>(async () => {
    log.push('send');
    return SENT_OK;
  });
  useAppStore.setState({ sendTurn });
});

describe('held answers on every way a run starts again', () => {
  const PATHS = [
    {
      name: 'continueWorkflowRun',
      stop: FAILURE_STOP,
      rules: undefined,
      start: () => useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A),
    },
    {
      name: 'retryWorkflowOrchestration',
      stop: FAILURE_STOP,
      rules: undefined,
      start: () => useAppStore.getState().retryWorkflowOrchestration(SESSION.id, RUN_A),
    },
    {
      name: 'resolvePresetChange',
      stop: PRESET_STOP,
      rules: PRESET_RULES,
      start: () => useAppStore.getState().resolvePresetChange(SESSION.id, RUN_A, 'apply'),
    },
    {
      name: 'resumeWorkflowRun',
      stop: PAUSED_STOP,
      rules: undefined,
      start: async () => {
        await useAppStore.getState().resumeWorkflowRun(SESSION.id, RUN_A);
        await vi.waitFor(() => expect(plannerRun).toHaveBeenCalled());
      },
    },
  ] as const;

  it.each(PATHS)(
    'sends the held answers before the orchestrator picks a step on $name, from persistence',
    async ({ stop, rules, start }) => {
      await seed({ runs: [{ id: RUN_A, stop, ...(rules !== undefined && { rules }) }] });
      await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });
      expect(useAppStore.getState().sessionAnsweredQuestions[SESSION.id]).toBeUndefined();

      await start();

      expect(sentContents()).toHaveLength(1);
      expect(sentContents()[0]).toContain(`A: ${HELD_ANSWER}`);
      expect(log.indexOf('send')).toBe(0);
      expect(log).toContain('planner');
      expect(await deliveredIds()).toEqual([HELD_ID]);
    },
  );

  it('delivers on a direct open of a run whose stop was already gone before a restart', async () => {
    await seed({ runs: [{ id: RUN_A }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });

    await useAppStore.getState().maybeAutoAdvanceWorkflow(SESSION.id);

    expect(sentContents()).toHaveLength(1);
    expect(await deliveredIds()).toEqual([HELD_ID]);
  });
});

describe('held answers and the spend checks', () => {
  it('does not start the answering agent when a resume is over the run limit', async () => {
    await seed({ runs: [{ id: RUN_A, stop: FAILURE_STOP, spendLimitUsd: 0 }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });

    await useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(plannerRun).not.toHaveBeenCalled();
    expect(runOf({ id: RUN_A })?.orchestrationStop?.kind).toBe('budget');
    expect(await deliveredIds()).toEqual([]);
  });

  it('does not start the answering agent when the auto advance is over the run limit', async () => {
    await seed({ runs: [{ id: RUN_A, spendLimitUsd: 0 }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });

    await useAppStore.getState().maybeAutoAdvanceWorkflow(SESSION.id);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(runOf({ id: RUN_A })?.orchestrationStop?.kind).toBe('budget');
    expect(await deliveredIds()).toEqual([]);
  });
});

describe('held answers when the delivery fails', () => {
  it('does not advance, shows the pending delivery and moves on only after Retry', async () => {
    await seed({ runs: [{ id: RUN_A, stop: FAILURE_STOP }] });
    await insertOpenQuestion(storySqlite(), {
      id: HELD_ID,
      sessionId: SESSION.id,
      workflowRunId: RUN_A,
      text: HELD_TEXT,
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(SESSION.id);
    await useAppStore
      .getState()
      .answerOpenQuestions(
        SESSION.id,
        [{ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER }],
        null,
      );
    expect(sendTurn).not.toHaveBeenCalled();
    sendTurn.mockRejectedValueOnce(new Error('The agent is not reachable.'));

    await useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A);

    expect(plannerRun).not.toHaveBeenCalled();
    expect(pending()?.error).toContain('The agent is not reachable.');
    expect(pending()?.pairs.map((pair) => pair.id)).toEqual([HELD_ID]);

    await useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A);
    await useAppStore.getState().maybeAutoAdvanceWorkflow(SESSION.id);

    expect(plannerRun).not.toHaveBeenCalled();
    expect(sendTurn).toHaveBeenCalledTimes(1);

    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId: SESSION.id, attemptId: pending()?.attemptId ?? '' });
    await vi.waitFor(() => expect(plannerRun).toHaveBeenCalled());

    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(pending()).toBeUndefined();
    expect(await deliveredIds()).toEqual([HELD_ID]);
  });
});

describe('held answers of a stopped run', () => {
  it('stay out of the send of an ordinary answer elsewhere', async () => {
    await seed({ runs: [{ id: RUN_A, stop: BUDGET_STOP }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });
    await insertOpenQuestion(storySqlite(), {
      id: ORDINARY_ID,
      sessionId: SESSION.id,
      text: ORDINARY_TEXT,
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(SESSION.id);
    await useAppStore.getState().loadSessionAnsweredQuestions(SESSION.id);

    await useAppStore
      .getState()
      .answerOpenQuestions(
        SESSION.id,
        [{ id: ORDINARY_ID, text: ORDINARY_TEXT, answer: ORDINARY_ANSWER }],
        null,
      );

    expect(sentContents()).toHaveLength(1);
    expect(sentContents()[0]).toContain(`A: ${ORDINARY_ANSWER}`);
    expect(sentContents()[0]).not.toContain(HELD_ANSWER);
    expect(await deliveredIds()).toEqual([ORDINARY_ID]);
  });
});

describe('held answers sent twice', () => {
  it('go out once when two advances race', async () => {
    await seed({ runs: [{ id: RUN_A }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });
    const gate = deferred();
    sendTurn.mockImplementationOnce(async () => {
      log.push('send');
      await gate.promise;
      return SENT_OK;
    });

    const first = useAppStore.getState().retryWorkflowOrchestration(SESSION.id, RUN_A);
    const second = useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A);
    await vi.waitFor(() => expect(sendTurn).toHaveBeenCalledTimes(1));
    gate.release();
    await Promise.all([first, second]);

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(await deliveredIds()).toEqual([HELD_ID]);
  });

  it('go out once when an answer and a resume overlap, and the resume waits for the answer send', async () => {
    await seed({ runs: [{ id: RUN_A, stop: PAUSED_STOP }] });
    await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });
    await insertOpenQuestion(storySqlite(), {
      id: ORDINARY_ID,
      sessionId: SESSION.id,
      text: ORDINARY_TEXT,
      suggestedAnswers: [],
      isBlocking: true,
    });
    await useAppStore.getState().loadSessionOpenQuestions(SESSION.id);
    const gate = deferred();
    sendTurn.mockImplementationOnce(async () => {
      log.push('send');
      await gate.promise;
      return SENT_OK;
    });

    const answering = useAppStore
      .getState()
      .answerOpenQuestions(
        SESSION.id,
        [{ id: ORDINARY_ID, text: ORDINARY_TEXT, answer: ORDINARY_ANSWER }],
        null,
      );
    await vi.waitFor(() => expect(sendTurn).toHaveBeenCalledTimes(1));
    await useAppStore.getState().resumeWorkflowRun(SESSION.id, RUN_A);
    await useAppStore.getState().continueWorkflowRun(SESSION.id, RUN_A);

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(plannerRun).not.toHaveBeenCalled();

    gate.release();
    await answering;
    await vi.waitFor(() => expect(plannerRun).toHaveBeenCalled());

    const heldSends = sentContents().filter((content) => content.includes(HELD_ANSWER));
    expect(heldSends).toHaveLength(1);
    expect(await deliveredIds()).toEqual([HELD_ID, ORDINARY_ID]);
  });
});

describe('held answers read the run again before each send', () => {
  const SECOND_RUN_CASES = [
    {
      name: 'stopped',
      change: () => patchRun({ id: RUN_B, patch: { orchestrationStop: BUDGET_STOP } }),
    },
    {
      name: 'archived',
      change: () => patchRun({ id: RUN_B, patch: { discardedAt: NOW } }),
    },
    {
      name: 'deleted',
      change: () =>
        useAppStore.setState((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            workflowRuns: session.workflowRuns.filter((run) => run.id !== RUN_B),
          })),
        })),
    },
  ] as const;

  it.each(SECOND_RUN_CASES)(
    'skips a run that was $name while the first run was sending',
    async ({ change }) => {
      await seed({ runs: [{ id: RUN_A }, { id: RUN_B }] });
      await hold({ id: HELD_ID, text: HELD_TEXT, answer: HELD_ANSWER, runId: RUN_A });
      await hold({ id: OTHER_ID, text: OTHER_TEXT, answer: OTHER_ANSWER, runId: RUN_B });
      const gate = deferred();
      sendTurn.mockImplementationOnce(async () => {
        log.push('send');
        await gate.promise;
        return SENT_OK;
      });

      const advancing = useAppStore.getState().maybeAutoAdvanceWorkflow(SESSION.id);
      await vi.waitFor(() => expect(sendTurn).toHaveBeenCalledTimes(1));
      change();
      gate.release();
      await advancing;

      expect(sentContents()).toHaveLength(1);
      expect(sentContents()[0]).toContain(HELD_ANSWER);
      expect(sentContents()[0]).not.toContain(OTHER_ANSWER);
      expect(await deliveredIds()).toEqual([HELD_ID]);
    },
  );
});
