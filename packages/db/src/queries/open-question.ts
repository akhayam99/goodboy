import type {
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionStatus,
  SessionId,
  WorkflowId,
} from '@goodboy/types';
import type { Database } from '../client';

interface OpenQuestionRow {
  id: string;
  session_id: string;
  workflow_id: string | null;
  created_by_step_ordinal: number | null;
  owned_by_step_ordinal: number | null;
  created_by_agent_id: string | null;
  text: string;
  suggested_answers: string;
  user_answer: string | null;
  status: string;
  created_at: number;
  answered_at: number | null;
  dismissed_at: number | null;
}

function toDomain(row: OpenQuestionRow): OpenQuestion {
  return {
    id: row.id as OpenQuestionId,
    sessionId: row.session_id as SessionId,
    workflowId: row.workflow_id ? (row.workflow_id as WorkflowId) : undefined,
    createdByStepOrdinal: row.created_by_step_ordinal ?? undefined,
    ownedByStepOrdinal: row.owned_by_step_ordinal ?? undefined,
    createdByAgentId: row.created_by_agent_id ? (row.created_by_agent_id as AgentId) : undefined,
    text: row.text,
    suggestedAnswers: JSON.parse(row.suggested_answers) as ReadonlyArray<string>,
    userAnswer: row.user_answer,
    status: row.status as OpenQuestionStatus,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    answeredAt: row.answered_at
      ? (new Date(row.answered_at).toISOString() as IsoDateTime)
      : undefined,
    dismissedAt: row.dismissed_at
      ? (new Date(row.dismissed_at).toISOString() as IsoDateTime)
      : undefined,
  };
}

export interface InsertOpenQuestionInput {
  readonly id: OpenQuestionId;
  readonly sessionId: SessionId;
  readonly workflowId?: WorkflowId;
  readonly createdByStepOrdinal?: number;
  readonly ownedByStepOrdinal?: number;
  readonly createdByAgentId?: AgentId;
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
}

export interface InsertOpenQuestionResult {
  readonly question: OpenQuestion;
  readonly inserted: boolean;
}

export async function insertOpenQuestion(
  db: Database,
  input: InsertOpenQuestionInput,
): Promise<InsertOpenQuestionResult> {
  const now = Date.now();
  await db.execute(
    `INSERT OR IGNORE INTO open_questions
       (id, session_id, workflow_id, created_by_step_ordinal, owned_by_step_ordinal,
        created_by_agent_id, text, suggested_answers, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      input.id,
      input.sessionId,
      input.workflowId ?? null,
      input.createdByStepOrdinal ?? null,
      input.ownedByStepOrdinal ?? null,
      input.createdByAgentId ?? null,
      input.text,
      JSON.stringify(input.suggestedAnswers),
      now,
    ],
  );
  const ownRows = await db.select<OpenQuestionRow>(`SELECT * FROM open_questions WHERE id = ?`, [
    input.id,
  ]);
  if (ownRows[0]) {
    return { question: toDomain(ownRows[0]), inserted: true };
  }
  // Conflict on partial unique index (session_id, text) WHERE status='open'.
  const existingRows = await db.select<OpenQuestionRow>(
    `SELECT * FROM open_questions WHERE session_id = ? AND text = ? AND status = 'open' LIMIT 1`,
    [input.sessionId, input.text],
  );
  const existing = existingRows[0];
  if (!existing) throw new Error(`open_question insert failed: ${input.id}`);
  return { question: toDomain(existing), inserted: false };
}

export async function listOpenQuestionsForSession(
  db: Database,
  sessionId: SessionId,
  status?: OpenQuestionStatus,
): Promise<ReadonlyArray<OpenQuestion>> {
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
}

export async function markOpenQuestionAnswered(
  db: Database,
  id: OpenQuestionId,
  userAnswer: string,
): Promise<void> {
  const now = Date.now();
  await db.execute(
    `UPDATE open_questions SET status = 'answered', user_answer = ?, answered_at = ? WHERE id = ?`,
    [userAnswer, now, id],
  );
}

export async function markOpenQuestionDismissed(db: Database, id: OpenQuestionId): Promise<void> {
  const now = Date.now();
  await db.execute(
    `UPDATE open_questions SET status = 'dismissed', dismissed_at = ? WHERE id = ?`,
    [now, id],
  );
}

export async function restoreOpenQuestion(db: Database, id: OpenQuestionId): Promise<void> {
  await db.execute(`UPDATE open_questions SET status = 'open', dismissed_at = NULL WHERE id = ?`, [
    id,
  ]);
}

function normalizeForMatch(s: string): string {
  return s
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .trim()
    .toLowerCase();
}

export async function markOpenQuestionsResolvedByText(
  db: Database,
  sessionId: SessionId,
  texts: ReadonlyArray<string>,
): Promise<number> {
  if (texts.length === 0) return 0;
  const targets = texts.map(normalizeForMatch).filter((s) => s.length > 0);
  if (targets.length === 0) return 0;

  const rows = await db.select<OpenQuestionRow>(
    `SELECT * FROM open_questions WHERE session_id = ? AND status = 'open'`,
    [sessionId],
  );
  if (rows.length === 0) return 0;

  const toResolve: string[] = [];
  for (const row of rows) {
    const n = normalizeForMatch(row.text);
    if (n.length === 0) continue;
    const hit = targets.some((t) => n === t || n.includes(t) || t.includes(n));
    if (hit) toResolve.push(row.id);
  }
  if (toResolve.length === 0) return 0;

  const now = Date.now();
  for (const id of toResolve) {
    await db.execute(
      `UPDATE open_questions
       SET status = 'answered', user_answer = ?, answered_at = ?
       WHERE id = ? AND status = 'open'`,
      ['[resolved by agent]', now, id],
    );
  }
  return toResolve.length;
}

export async function transferOpenQuestionOwnership(
  db: Database,
  workflowId: WorkflowId,
  fromOrdinal: number,
  toOrdinal: number,
): Promise<void> {
  await db.execute(
    `UPDATE open_questions
     SET owned_by_step_ordinal = ?
     WHERE workflow_id = ? AND owned_by_step_ordinal = ? AND status = 'open'`,
    [toOrdinal, workflowId, fromOrdinal],
  );
}
