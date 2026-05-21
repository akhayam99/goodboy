import type {
  IsoDateTime,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

interface SessionExternalTaskRow {
  session_id: string;
  provider: string;
  external_id: string;
  identifier: string;
  url: string;
  title: string;
  created_at: number;
}

function toDomain(row: SessionExternalTaskRow): SessionExternalTask {
  return {
    sessionId: row.session_id as SessionId,
    provider: row.provider as SessionExternalTaskProvider,
    externalId: row.external_id,
    identifier: row.identifier,
    url: row.url,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function setSessionExternalTask(
  db: Database,
  task: SessionExternalTask,
): Promise<void> {
  const created = Date.parse(task.createdAt);
  await db.execute(
    `INSERT INTO session_external_tasks (session_id, provider, external_id, identifier, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET
       provider = excluded.provider,
       external_id = excluded.external_id,
       identifier = excluded.identifier,
       url = excluded.url,
       title = excluded.title`,
    [
      task.sessionId,
      task.provider,
      task.externalId,
      task.identifier,
      task.url,
      task.title,
      created,
    ],
  );
}

export async function getSessionExternalTask(
  db: Database,
  sessionId: SessionId,
): Promise<SessionExternalTask | null> {
  const rows = await db.select<SessionExternalTaskRow>(
    'SELECT * FROM session_external_tasks WHERE session_id = ? LIMIT 1',
    [sessionId],
  );
  const row = rows[0];
  return row ? toDomain(row) : null;
}

export async function removeSessionExternalTask(db: Database, sessionId: SessionId): Promise<void> {
  await db.execute('DELETE FROM session_external_tasks WHERE session_id = ?', [sessionId]);
}
