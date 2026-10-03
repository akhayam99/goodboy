import {
  isSessionExternalTaskProvider,
  type IsoDateTime,
  type SessionExternalTaskProvider,
  type WorkspaceExternalTask,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type WorkspaceExternalTaskRow = {
  readonly workspace_id: string;
  readonly provider: string;
  readonly external_id: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
  readonly created_at: number;
};

type ToDomainParams = {
  readonly row: WorkspaceExternalTaskRow;
};

const toDomain = ({ row }: ToDomainParams): WorkspaceExternalTask | null => {
  if (isSessionExternalTaskProvider(row.provider) === false) {
    return null;
  }
  return {
    workspaceId: row.workspace_id as WorkspaceId,
    provider: row.provider,
    externalId: row.external_id,
    identifier: row.identifier,
    url: row.url,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
};

type UpsertParams = {
  readonly db: Database;
  readonly task: WorkspaceExternalTask;
};

export const upsertWorkspaceExternalTask = async ({ db, task }: UpsertParams): Promise<void> => {
  if (isSessionExternalTaskProvider(task.provider) === false) {
    throw new Error(`invalid external task provider: ${task.provider}`);
  }
  await db.execute(
    `INSERT INTO workspace_external_tasks
       (workspace_id, provider, external_id, identifier, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, provider, external_id) DO UPDATE SET
       identifier = excluded.identifier,
       url = excluded.url,
       title = excluded.title`,
    [
      task.workspaceId,
      task.provider,
      task.externalId,
      task.identifier,
      task.url,
      task.title,
      Date.parse(task.createdAt),
    ],
  );
};

type ListParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listWorkspaceExternalTasks = async ({
  db,
  workspaceId,
}: ListParams): Promise<ReadonlyArray<WorkspaceExternalTask>> => {
  const rows = await db.select<WorkspaceExternalTaskRow>(
    `SELECT workspace_id, provider, external_id, identifier, url, title, created_at
       FROM workspace_external_tasks
      WHERE workspace_id = ?
      ORDER BY created_at ASC, provider ASC, external_id ASC`,
    [workspaceId],
  );
  return rows.flatMap((row) => {
    const task = toDomain({ row });
    return task === null ? [] : [task];
  });
};

type DeleteParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export const deleteWorkspaceExternalTask = async ({
  db,
  workspaceId,
  provider,
  externalId,
}: DeleteParams): Promise<void> => {
  await db.execute(
    `DELETE FROM workspace_external_tasks
      WHERE workspace_id = ? AND provider = ? AND external_id = ?`,
    [workspaceId, provider, externalId],
  );
};
