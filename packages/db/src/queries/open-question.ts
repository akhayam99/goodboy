import type {
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionSelectMode,
  OpenQuestionStatus,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type OpenQuestionRow = {
  id: string;
  session_id: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  created_by_step_ordinal: number | null;
  owned_by_step_ordinal: number | null;
  created_by_agent_id: string | null;
  text: string;
  suggested_answers: string;
  recommended_answer: string | null;
  select_mode: string | null;
  user_answer: string | null;
  turn_ordinal: number | null;
  status: string;
  is_blocking?: number;
  answer_source?: 'user' | 'agent' | null;
  answered_by_agent_id?: string | null;
  created_at: number;
  answered_at: number | null;
  answer_delivered_at: number | null;
  dismissed_at: number | null;
};

const toSelectMode = (raw: string | null): OpenQuestionSelectMode | undefined => {
  if (raw === 'one' || raw === 'many') {
    return raw;
  }
  return undefined;
};

const toDomain = (row: OpenQuestionRow): OpenQuestion => {
  return {
    id: row.id as OpenQuestionId,
    sessionId: row.session_id as SessionId,
    workflowId: row.workflow_id ? (row.workflow_id as WorkflowId) : undefined,
    workflowRunId: row.workflow_run_id ? (row.workflow_run_id as WorkflowRunId) : undefined,
    createdByStepOrdinal: row.created_by_step_ordinal ?? undefined,
    ownedByStepOrdinal: row.owned_by_step_ordinal ?? undefined,
    createdByAgentId: row.created_by_agent_id ? (row.created_by_agent_id as AgentId) : undefined,
    text: row.text,
    suggestedAnswers: JSON.parse(row.suggested_answers) as ReadonlyArray<string>,
    recommendedAnswer: row.recommended_answer ?? undefined,
    selectMode: toSelectMode(row.select_mode),
    isBlocking: row.is_blocking === 1,
    userAnswer: row.user_answer,
    answerSource: row.answer_source ?? undefined,
    answeredByAgentId:
      row.answered_by_agent_id != null ? (row.answered_by_agent_id as AgentId) : undefined,
    turnOrdinal: row.turn_ordinal ?? undefined,
    status: row.status as OpenQuestionStatus,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    answeredAt: row.answered_at
      ? (new Date(row.answered_at).toISOString() as IsoDateTime)
      : undefined,
    answerDeliveredAt: row.answer_delivered_at
      ? (new Date(row.answer_delivered_at).toISOString() as IsoDateTime)
      : undefined,
    dismissedAt: row.dismissed_at
      ? (new Date(row.dismissed_at).toISOString() as IsoDateTime)
      : undefined,
  };
};

export type InsertOpenQuestionInput = {
  readonly id: OpenQuestionId;
  readonly sessionId: SessionId;
  readonly workflowId?: WorkflowId;
  readonly workflowRunId?: WorkflowRunId;
  readonly createdByStepOrdinal?: number;
  readonly ownedByStepOrdinal?: number;
  readonly createdByAgentId?: AgentId;
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
  readonly recommendedAnswer?: string;
  readonly selectMode?: OpenQuestionSelectMode;
  readonly isBlocking?: boolean;
  readonly turnOrdinal?: number;
};

export type InsertOpenQuestionResult = {
  readonly question: OpenQuestion;
  readonly inserted: boolean;
};

export const insertOpenQuestion = async (
  db: Database,
  input: InsertOpenQuestionInput,
): Promise<InsertOpenQuestionResult> => {
  const now = Date.now();
  await db.execute(
    `INSERT OR IGNORE INTO open_questions
       (id, session_id, workflow_id, workflow_run_id, created_by_step_ordinal, owned_by_step_ordinal,
        created_by_agent_id, text, suggested_answers, recommended_answer, select_mode, is_blocking,
        turn_ordinal, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      input.id,
      input.sessionId,
      input.workflowId ?? null,
      input.workflowRunId ?? null,
      input.createdByStepOrdinal ?? null,
      input.ownedByStepOrdinal ?? null,
      input.createdByAgentId ?? null,
      input.text,
      JSON.stringify(input.suggestedAnswers),
      input.recommendedAnswer ?? null,
      input.selectMode ?? null,
      input.isBlocking === true ? 1 : 0,
      input.turnOrdinal ?? null,
      now,
    ],
  );
  const ownRows = await db.select<OpenQuestionRow>(`SELECT * FROM open_questions WHERE id = ?`, [
    input.id,
  ]);
  if (ownRows[0]) {
    return { question: toDomain(ownRows[0]), inserted: true };
  }
  const existingRows = await db.select<OpenQuestionRow>(
    `SELECT * FROM open_questions WHERE session_id = ? AND text = ? AND status = 'open' LIMIT 1`,
    [input.sessionId, input.text],
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new Error(`open_question insert failed: ${input.id}`);
  }
  return { question: toDomain(existing), inserted: false };
};

export const listOpenQuestionsForSession = async (
  db: Database,
  sessionId: SessionId,
  status?: OpenQuestionStatus,
): Promise<ReadonlyArray<OpenQuestion>> => {
  const rows = status
    ? await db.select<OpenQuestionRow>(
        `SELECT * FROM open_questions WHERE session_id = ? AND status = ? ORDER BY created_at ASC`,
        [sessionId, status],
      )
    : await db.select<OpenQuestionRow>(
        `SELECT * FROM open_questions WHERE session_id = ? ORDER BY created_at ASC`,
        [sessionId],
      );
  return rows.map(toDomain);
};

export const listResolvedQuestionTextsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ text: string }>(
    `SELECT text FROM open_questions WHERE session_id = ? AND status != 'open'`,
    [sessionId],
  );
  return rows.map((r) => r.text);
};

type GetOpenQuestionByIdParams = {
  readonly db: Database;
  readonly id: OpenQuestionId;
};

export const getOpenQuestionById = async ({
  db,
  id,
}: GetOpenQuestionByIdParams): Promise<OpenQuestion | null> => {
  const rows = await db.select<OpenQuestionRow>('SELECT * FROM open_questions WHERE id = ?', [id]);
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

export type OpenQuestionAnswerProvenance = Readonly<{
  source: 'user' | 'agent';
  agentId?: AgentId;
}>;

export const markOpenQuestionAnswered = async (
  db: Database,
  id: OpenQuestionId,
  userAnswer: string,
  provenance?: OpenQuestionAnswerProvenance,
): Promise<void> => {
  const now = Date.now();
  const source = provenance?.source ?? 'user';
  const answeredByAgentId = source === 'agent' ? (provenance?.agentId ?? null) : null;
  await db.execute(
    `UPDATE open_questions
     SET status = 'answered', user_answer = ?, answered_at = ?, answer_source = ?,
         answered_by_agent_id = ?
     WHERE id = ?`,
    [userAnswer, now, source, answeredByAgentId, id],
  );
};

export type MarkOpenQuestionAnswersDeliveredParams = {
  readonly db: Database;
  readonly ids: ReadonlyArray<OpenQuestionId>;
};

export const markOpenQuestionAnswersDelivered = async ({
  db,
  ids,
}: MarkOpenQuestionAnswersDeliveredParams): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const placeholders = ids.map(() => '?').join(', ');
  await db.execute(
    `UPDATE open_questions SET answer_delivered_at = ? WHERE id IN (${placeholders}) AND answer_delivered_at IS NULL`,
    [Date.now(), ...ids],
  );
};

export const markOpenQuestionDismissed = async (
  db: Database,
  id: OpenQuestionId,
): Promise<void> => {
  const now = Date.now();
  await db.execute(
    `UPDATE open_questions SET status = 'dismissed', dismissed_at = ? WHERE id = ?`,
    [now, id],
  );
};

export const restoreOpenQuestion = async (db: Database, id: OpenQuestionId): Promise<void> => {
  await db.execute(`UPDATE open_questions SET status = 'open', dismissed_at = NULL WHERE id = ?`, [
    id,
  ]);
};

function normalizeForMatch(s: string): string {
  return s
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .trim()
    .toLowerCase();
}

export const markOpenQuestionsResolvedByText = async (
  db: Database,
  sessionId: SessionId,
  texts: ReadonlyArray<string>,
): Promise<number> => {
  if (texts.length === 0) {
    return 0;
  }
  const targets = texts.map(normalizeForMatch).filter((s) => s.length > 0);
  if (targets.length === 0) {
    return 0;
  }

  const rows = await db.select<OpenQuestionRow>(
    `SELECT * FROM open_questions WHERE session_id = ? AND status = 'open'`,
    [sessionId],
  );
  if (rows.length === 0) {
    return 0;
  }

  const toResolve: string[] = [];
  for (const row of rows) {
    const n = normalizeForMatch(row.text);
    if (n.length === 0) {
      continue;
    }
    const hit = targets.some((t) => n === t || n.includes(t) || t.includes(n));
    if (hit) {
      toResolve.push(row.id);
    }
  }
  if (toResolve.length === 0) {
    return 0;
  }

  const now = Date.now();
  for (const id of toResolve) {
    await db.execute(
      `UPDATE open_questions
       SET status = 'answered', user_answer = ?, answered_at = ?, answer_delivered_at = ?
       WHERE id = ? AND status = 'open'`,
      ['[resolved by agent]', now, now, id],
    );
  }
  return toResolve.length;
};

export const transferOpenQuestionOwnership = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  fromOrdinal: number,
  toOrdinal: number,
): Promise<void> => {
  await db.execute(
    `UPDATE open_questions
     SET owned_by_step_ordinal = ?
     WHERE workflow_run_id = ? AND owned_by_step_ordinal = ? AND status = 'open'`,
    [toOrdinal, workflowRunId, fromOrdinal],
  );
};
