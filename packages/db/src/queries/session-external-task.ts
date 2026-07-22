import type {
  IsoDateTime,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type SessionExternalTaskRow = {
  readonly session_id: string;
  readonly provider: string;
  readonly external_id: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
  readonly created_at: number;
};

type ToDomainParams = {
  readonly row: SessionExternalTaskRow;
};

const toDomain = ({ row }: ToDomainParams): SessionExternalTask => ({
  sessionId: row.session_id as SessionId,
  provider: row.provider as SessionExternalTaskProvider,
  externalId: row.external_id,
  identifier: row.identifier,
  url: row.url,
  title: row.title,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

type UpsertParams = {
  readonly db: Database;
  readonly task: SessionExternalTask;
};

export const upsertSessionExternalTask = async ({ db, task }: UpsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_external_tasks (session_id, provider, external_id, identifier, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, provider, external_id) DO UPDATE SET
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
      Date.parse(task.createdAt),
    ],
  );
};

type ListForSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listSessionExternalTasks = async ({
  db,
  sessionId,
}: ListForSessionParams): Promise<ReadonlyArray<SessionExternalTask>> => {
  const rows = await db.select<SessionExternalTaskRow>(
    `SELECT session_id, provider, external_id, identifier, url, title, created_at
       FROM session_external_tasks
      WHERE session_id = ?
      ORDER BY created_at ASC, provider ASC, external_id ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};

type ListForWorkspaceParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listExternalTasksForWorkspace = async ({
  db,
  workspaceId,
}: ListForWorkspaceParams): Promise<ReadonlyArray<SessionExternalTask>> => {
  const rows = await db.select<SessionExternalTaskRow>(
    `SELECT t.session_id, t.provider, t.external_id, t.identifier, t.url, t.title, t.created_at
       FROM session_external_tasks t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?
      ORDER BY t.created_at ASC, t.provider ASC, t.external_id ASC`,
    [workspaceId],
  );
  return rows.map((row) => toDomain({ row }));
};

type DeleteParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export const deleteSessionExternalTask = async ({
  db,
  sessionId,
  provider,
  externalId,
}: DeleteParams): Promise<void> => {
  await db.execute(
    `DELETE FROM session_external_tasks
      WHERE session_id = ? AND provider = ? AND external_id = ?`,
    [sessionId, provider, externalId],
  );
};
