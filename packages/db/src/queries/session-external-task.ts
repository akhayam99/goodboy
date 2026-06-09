import type {
  IsoDateTime,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type SessionExternalTaskRow = {
  session_id: string;
  provider: string;
  external_id: string;
  identifier: string;
  url: string;
  title: string;
  created_at: number;
};

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

export const setSessionExternalTask = async (
  db: Database,
  task: SessionExternalTask,
): Promise<void> => {
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
};

export const getSessionExternalTask = async (
  db: Database,
  sessionId: SessionId,
): Promise<SessionExternalTask | null> => {
  const rows = await db.select<SessionExternalTaskRow>(
    'SELECT * FROM session_external_tasks WHERE session_id = ? LIMIT 1',
    [sessionId],
  );
  const row = rows[0];
  return row ? toDomain(row) : null;
};

export const listExternalTasksForWorkspace = async (
  db: Database,
  workspaceId: string,
): Promise<ReadonlyArray<SessionExternalTask>> => {
  const rows = await db.select<SessionExternalTaskRow>(
    `SELECT t.session_id, t.provider, t.external_id, t.identifier, t.url, t.title, t.created_at
       FROM session_external_tasks t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

export const removeSessionExternalTask = async (
  db: Database,
  sessionId: SessionId,
): Promise<void> => {
  await db.execute('DELETE FROM session_external_tasks WHERE session_id = ?', [sessionId]);
};
