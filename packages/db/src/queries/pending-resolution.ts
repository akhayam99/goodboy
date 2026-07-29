import type {
  IsoDateTime,
  PendingResolution,
  PendingResolutionOutcome,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type PendingResolutionRow = {
  id: string;
  session_id: string;
  pr_number: number;
  thread_id: string;
  commit_sha: string;
  reply: string | null;
  outcome: string | null;
  created_at: number;
};

type QueueParams = {
  readonly db: Database;
  readonly id: string;
  readonly sessionId: SessionId;
  readonly prNumber: number;
  readonly threadId: string;
  readonly commitSha: string;
  readonly reply: string | null;
  readonly outcome: PendingResolutionOutcome | null;
};

type ListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type DeleteParams = ListParams & {
  readonly threadId: string;
};

type ToDomainParams = {
  readonly row: PendingResolutionRow;
};

type ToOutcomeParams = {
  readonly value: string | null;
};

const toOutcome = ({ value }: ToOutcomeParams): PendingResolutionOutcome | null => {
  if (value === 'resolved' || value === 'wontfix' || value === 'analyzed') {
    return value;
  }
  return null;
};

const toDomain = ({ row }: ToDomainParams): PendingResolution => {
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    prNumber: row.pr_number,
    threadId: row.thread_id,
    commitSha: row.commit_sha,
    reply: row.reply,
    outcome: toOutcome({ value: row.outcome }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
};

const SELECT_COLUMNS = `id, session_id, pr_number, thread_id, commit_sha, reply, outcome, created_at`;

export const queuePendingResolution = async ({
  db,
  id,
  sessionId,
  prNumber,
  threadId,
  commitSha,
  reply,
  outcome,
}: QueueParams): Promise<void> => {
  await db.execute(
    `INSERT INTO pending_resolutions
       (id, session_id, pr_number, thread_id, commit_sha, reply, outcome, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, thread_id)
     DO UPDATE SET
       commit_sha = excluded.commit_sha,
       reply = excluded.reply,
       outcome = excluded.outcome,
       created_at = excluded.created_at`,
    [id, sessionId, prNumber, threadId, commitSha, reply, outcome, Date.now()],
  );
};

export const listPendingResolutionsForSession = async ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<PendingResolution>> => {
  const rows = await db.select<PendingResolutionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM pending_resolutions
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};

export const deletePendingResolution = async ({
  db,
  sessionId,
  threadId,
}: DeleteParams): Promise<void> => {
  await db.execute(`DELETE FROM pending_resolutions WHERE session_id = ? AND thread_id = ?`, [
    sessionId,
    threadId,
  ]);
};
