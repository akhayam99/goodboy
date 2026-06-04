import type { IsoDateTime, PendingResolution, SessionId } from '@goodboy/types';
import type { Database } from '../client';

interface PendingResolutionRow {
  id: string;
  session_id: string;
  pr_number: number;
  thread_id: string;
  commit_sha: string;
  created_at: number;
}

function toDomain(row: PendingResolutionRow): PendingResolution {
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    prNumber: row.pr_number,
    threadId: row.thread_id,
    commitSha: row.commit_sha,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

const SELECT_COLUMNS = `id, session_id, pr_number, thread_id, commit_sha, created_at`;

export async function queuePendingResolution(
  db: Database,
  id: string,
  sessionId: SessionId,
  prNumber: number,
  threadId: string,
  commitSha: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO pending_resolutions (id, session_id, pr_number, thread_id, commit_sha, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, thread_id)
     DO UPDATE SET commit_sha = excluded.commit_sha, created_at = excluded.created_at`,
    [id, sessionId, prNumber, threadId, commitSha, Date.now()],
  );
}

export async function listPendingResolutionsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<PendingResolution>> {
  const rows = await db.select<PendingResolutionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM pending_resolutions
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function deletePendingResolution(
  db: Database,
  sessionId: SessionId,
  threadId: string,
): Promise<void> {
  await db.execute(`DELETE FROM pending_resolutions WHERE session_id = ? AND thread_id = ?`, [
    sessionId,
    threadId,
  ]);
}
