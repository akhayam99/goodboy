import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type OpenQuestionId,
  type SessionId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  insertOpenQuestion,
  listOpenQuestionsForSession,
  supersedeEarlierBlockingQuestions,
} from './open-question';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const implementer = brandId<AgentId>({ value: 'agent-implementer' });
const tester = brandId<AgentId>({ value: 'agent-tester' });
const runId = brandId<WorkflowRunId>({ value: 'run-ledger-core' });
const otherRunId = brandId<WorkflowRunId>({ value: 'run-notify-relay' });

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'Harborline', '/tmp/harborline', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES (?, ?, ?, '', ?, ?, 1)`,
    ['workflow-harborline', workspaceId, 'Settlement export', now, now],
  );
  for (const runInstanceId of [runId, otherRunId]) {
    await db.execute(
      `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, created_at) VALUES (?, ?, 'workflow-harborline', 0, 0, 0, 'immediate', 'static', 1)`,
      [runInstanceId, sessionId],
    );
  }
  for (const agentId of [implementer, tester]) {
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)`,
      [agentId, sessionId, 0, agentId, 'running'],
    );
  }
  return db;
};

type Db = Awaited<ReturnType<typeof seed>>;

type AskParams = {
  readonly id: string;
  readonly agentId: AgentId;
  readonly turnOrdinal?: number;
  readonly isBlocking?: boolean;
  readonly workflowRunId?: WorkflowRunId;
};

type AskArgs = {
  readonly db: Db;
  readonly question: AskParams;
};

const ask = async ({ db, question }: AskArgs) =>
  insertOpenQuestion(db, {
    id: brandId<OpenQuestionId>({ value: question.id }),
    sessionId,
    createdByAgentId: question.agentId,
    text: `Question ${question.id}`,
    suggestedAnswers: [],
    isBlocking: question.isBlocking ?? true,
    ...(question.turnOrdinal !== undefined && { turnOrdinal: question.turnOrdinal }),
    ...(question.workflowRunId !== undefined && { workflowRunId: question.workflowRunId }),
  });

describe('supersedeEarlierBlockingQuestions', () => {
  it('settles the open blocking questions the same agent asked in earlier turns of the run', async () => {
    const db = await seed();
    await ask({
      db,
      question: { id: 'q1', agentId: implementer, turnOrdinal: 1, workflowRunId: runId },
    });
    await ask({
      db,
      question: { id: 'q2', agentId: implementer, turnOrdinal: 2, workflowRunId: runId },
    });
    await ask({
      db,
      question: { id: 'q3', agentId: implementer, turnOrdinal: 3, workflowRunId: runId },
    });

    const superseded = await supersedeEarlierBlockingQuestions({
      db,
      sessionId,
      agentId: implementer,
      workflowRunId: runId,
      turnOrdinal: 3,
      keepIds: [brandId<OpenQuestionId>({ value: 'q3' })],
    });

    expect(superseded.map((question) => question.id)).toEqual(['q1', 'q2']);
    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    expect(open.map((question) => question.id)).toEqual(['q3']);
    const answered = await listOpenQuestionsForSession(db, sessionId, 'answered');
    expect(answered.map((question) => question.userAnswer)).toEqual([
      '[resolved by agent]',
      '[resolved by agent]',
    ]);
    expect(answered.every((question) => question.answerDeliveredAt !== undefined)).toBe(true);
  });

  it('keeps a question asked in the same turn, another agent, another run and one that does not block', async () => {
    const db = await seed();
    await ask({
      db,
      question: { id: 'same-turn', agentId: implementer, turnOrdinal: 3, workflowRunId: runId },
    });
    await ask({
      db,
      question: { id: 'other-agent', agentId: tester, turnOrdinal: 1, workflowRunId: runId },
    });
    await ask({
      db,
      question: {
        id: 'other-run',
        agentId: implementer,
        turnOrdinal: 1,
        workflowRunId: otherRunId,
      },
    });
    await ask({
      db,
      question: {
        id: 'parked',
        agentId: implementer,
        turnOrdinal: 1,
        isBlocking: false,
        workflowRunId: runId,
      },
    });
    await ask({
      db,
      question: { id: 'fresh', agentId: implementer, turnOrdinal: 3, workflowRunId: runId },
    });

    const superseded = await supersedeEarlierBlockingQuestions({
      db,
      sessionId,
      agentId: implementer,
      workflowRunId: runId,
      turnOrdinal: 3,
      keepIds: [brandId<OpenQuestionId>({ value: 'fresh' })],
    });

    expect(superseded).toEqual([]);
    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    expect(open).toHaveLength(5);
  });

  it('settles a question held in prose that has no turn ordinal', async () => {
    const db = await seed();
    await ask({ db, question: { id: 'prose', agentId: implementer } });
    await ask({ db, question: { id: 'latest', agentId: implementer, turnOrdinal: 2 } });

    const superseded = await supersedeEarlierBlockingQuestions({
      db,
      sessionId,
      agentId: implementer,
      workflowRunId: null,
      turnOrdinal: 2,
      keepIds: [brandId<OpenQuestionId>({ value: 'latest' })],
    });

    expect(superseded.map((question) => question.id)).toEqual(['prose']);
  });
});
