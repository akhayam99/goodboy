import type { SessionId } from '@goodboy/types';
import type { Database } from '../client';

export type ThreadRead = {
  readonly threadId: string;
  readonly readAt: number;
};

type ListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type MarkParams = ListParams & {
  readonly marks: ReadonlyArray<ThreadRead>;
};

export const listThreadReads = ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<ThreadRead>> =>
  db.select<ThreadRead>(
    'SELECT thread_id AS threadId, read_at AS readAt FROM thread_reads WHERE session_id = ? ORDER BY thread_id',
    [sessionId],
  );

export const markThreadsRead = async ({ db, sessionId, marks }: MarkParams): Promise<void> => {
  if (marks.length === 0) {
    return;
  }
  const writtenAt = Date.now();
  await db.transaction({
    statements: marks.map(({ threadId, readAt }) => ({
      sql: `INSERT INTO thread_reads (id, session_id, thread_id, read_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (session_id, thread_id) DO UPDATE SET
          read_at = MAX(read_at, excluded.read_at),
          updated_at = excluded.updated_at`,
      params: [`${sessionId}:${threadId}`, sessionId, threadId, readAt, writtenAt, writtenAt],
    })),
  });
};
