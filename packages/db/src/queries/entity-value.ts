import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';

export const WORKSPACE_VALUE_KEYS = [
  'auto.treeLimitUsd',
  'terminal.workspaceFolder',
  'sessions.pinned',
] as const;

export type WorkspaceValueKey = (typeof WORKSPACE_VALUE_KEYS)[number];

export const PROJECT_VALUE_KEYS = [
  'folder.purpose',
  'folder.git',
  'worktree.carry',
  'worktree.setup',
] as const;

export type ProjectValueKey = (typeof PROJECT_VALUE_KEYS)[number];

type ValueRow = {
  readonly value: string;
};

type WorkspaceTarget = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly key: WorkspaceValueKey;
};

type ProjectTarget = {
  readonly db: Database;
  readonly projectId: ProjectId;
  readonly key: ProjectValueKey;
};

type WorkspaceSet = Omit<WorkspaceTarget, 'db'> & { readonly value: string | null };

type WorkspaceSetParams = WorkspaceTarget & { readonly value: string | null };

export type ProjectValueWrite = Omit<ProjectTarget, 'db'> & { readonly value: string };

type WorkspaceWriteParams = WorkspaceTarget & { readonly value: string };

type ProjectWriteParams = ProjectTarget & { readonly value: string };

type ProjectExpectedParams = ProjectWriteParams & { readonly expected: string };

type WorkspaceExpectedParams = WorkspaceWriteParams & { readonly expected: string };

type ProjectKeyParams = {
  readonly db: Database;
  readonly key: ProjectValueKey;
};

export type ProjectValueRow = {
  readonly projectId: ProjectId;
  readonly value: string;
};

export const getWorkspaceValue = async ({
  db,
  workspaceId,
  key,
}: WorkspaceTarget): Promise<string | null> => {
  const rows = await db.select<ValueRow>(
    'SELECT value FROM workspace_values WHERE workspace_id = ? AND key = ?',
    [workspaceId, key],
  );
  return rows[0]?.value ?? null;
};

export const setWorkspaceValueStatement = ({
  workspaceId,
  key,
  value,
}: WorkspaceSet): PlainStatement => {
  if (value === null) {
    return {
      sql: 'DELETE FROM workspace_values WHERE workspace_id = ? AND key = ?',
      params: [workspaceId, key],
    };
  }
  return {
    sql: `INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    params: [workspaceId, key, value, Date.now()],
  };
};

export const setWorkspaceValue = async ({ db, ...target }: WorkspaceSetParams): Promise<void> => {
  const statement = setWorkspaceValueStatement(target);
  await db.execute(statement.sql, statement.params);
};

export const insertWorkspaceValueIfAbsent = async ({
  db,
  workspaceId,
  key,
  value,
}: WorkspaceWriteParams): Promise<boolean> => {
  const result = await db.execute(
    `INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id, key) DO NOTHING`,
    [workspaceId, key, value, Date.now()],
  );
  return result.rowsAffected === 1;
};

export const replaceWorkspaceValueIfUnchanged = async ({
  db,
  workspaceId,
  key,
  expected,
  value,
}: WorkspaceExpectedParams): Promise<boolean> => {
  const result = await db.execute(
    'UPDATE workspace_values SET value = ?, updated_at = ? WHERE workspace_id = ? AND key = ? AND value = ?',
    [value, Date.now(), workspaceId, key, expected],
  );
  return result.rowsAffected === 1;
};

export const getProjectValue = async ({
  db,
  projectId,
  key,
}: ProjectTarget): Promise<string | null> => {
  const rows = await db.select<ValueRow>(
    'SELECT value FROM project_values WHERE project_id = ? AND key = ?',
    [projectId, key],
  );
  return rows[0]?.value ?? null;
};

export const setProjectValueStatement = ({
  projectId,
  key,
  value,
}: ProjectValueWrite): PlainStatement => ({
  sql: `INSERT INTO project_values (project_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  params: [projectId, key, value, Date.now()],
});

export const setProjectValue = async ({ db, ...target }: ProjectWriteParams): Promise<void> => {
  const statement = setProjectValueStatement(target);
  await db.execute(statement.sql, statement.params);
};

export const insertProjectValueIfAbsent = async ({
  db,
  projectId,
  key,
  value,
}: ProjectWriteParams): Promise<boolean> => {
  const result = await db.execute(
    `INSERT INTO project_values (project_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO NOTHING`,
    [projectId, key, value, Date.now()],
  );
  return result.rowsAffected === 1;
};

export const replaceProjectValueIfUnchanged = async ({
  db,
  projectId,
  key,
  expected,
  value,
}: ProjectExpectedParams): Promise<boolean> => {
  const result = await db.execute(
    'UPDATE project_values SET value = ?, updated_at = ? WHERE project_id = ? AND key = ? AND value = ?',
    [value, Date.now(), projectId, key, expected],
  );
  return result.rowsAffected === 1;
};

export const deleteProjectValue = async ({ db, projectId, key }: ProjectTarget): Promise<void> => {
  await db.execute('DELETE FROM project_values WHERE project_id = ? AND key = ?', [projectId, key]);
};

type ProjectValueRowRaw = {
  readonly project_id: ProjectId;
  readonly value: string;
};

export const listProjectValues = async ({
  db,
  key,
}: ProjectKeyParams): Promise<ReadonlyArray<ProjectValueRow>> => {
  const rows = await db.select<ProjectValueRowRaw>(
    'SELECT project_id, value FROM project_values WHERE key = ? ORDER BY project_id',
    [key],
  );
  return rows.map((row) => ({ projectId: row.project_id, value: row.value }));
};
