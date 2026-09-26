import type {
  IsoDateTime,
  OverrideSettings,
  Workspace,
  WorkspaceId,
  WorkspaceProfile,
} from '@goodboy/types';
import type { Database } from '../client';
import {
  REPLY_SETTING_COLUMNS,
  overridesFromRow,
  replySettingValues,
  type OverrideRow,
} from './override-row';

type WorkspaceRow = OverrideRow & {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly created_at: number;
  readonly updated_at: number;
  readonly deleted_at: number | null;
  readonly disconnected_at: number | null;
  readonly last_accessed_at: number | null;
  readonly profile_workspace_id: string | null;
  readonly profile_roles_json: string | null;
  readonly profile_about_work: string | null;
  readonly profile_working_rules: string | null;
  readonly profile_explain_more_json: string | null;
};

const WORKSPACE_SELECT = `
  SELECT
    w.*,
    wp.workspace_id AS profile_workspace_id,
    wp.roles_json AS profile_roles_json,
    wp.about_work AS profile_about_work,
    wp.working_rules AS profile_working_rules,
    wp.explain_more_json AS profile_explain_more_json
  FROM workspaces w
  LEFT JOIN workspace_profiles wp ON wp.workspace_id = w.id`;

type ProfileParams = {
  readonly row: WorkspaceRow;
};

const parseLabels = ({ json }: { readonly json: string | null }): ReadonlyArray<string> => {
  if (json === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
};

const profileFromRow = ({ row }: ProfileParams): WorkspaceProfile | undefined => {
  if (row.profile_workspace_id === null) {
    return undefined;
  }
  return {
    roles: parseLabels({ json: row.profile_roles_json }),
    aboutWork: row.profile_about_work,
    workingRules: row.profile_working_rules,
    explainMore: parseLabels({ json: row.profile_explain_more_json }),
  };
};

type ToDomainParams = {
  readonly row: WorkspaceRow;
};

const toDomain = ({ row }: ToDomainParams): Workspace => {
  const profile = profileFromRow({ row });
  return {
    id: row.id as WorkspaceId,
    name: row.name,
    slug: row.slug,
    ...(profile === undefined ? {} : { profile }),
    overrides: overridesFromRow({ row }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
    ...(row.deleted_at === null
      ? {}
      : { deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime }),
    ...(row.disconnected_at === null
      ? {}
      : { disconnectedAt: new Date(row.disconnected_at).toISOString() as IsoDateTime }),
    ...(row.last_accessed_at === null
      ? {}
      : { lastAccessedAt: new Date(row.last_accessed_at).toISOString() as IsoDateTime }),
  };
};

const serializeObject = ({ value }: { readonly value: object | null }): string | null =>
  value === null || Object.keys(value).length === 0 ? null : JSON.stringify(value);

const serializeProviderPool = ({
  providerPool,
}: {
  readonly providerPool: OverrideSettings['providerPool'];
}): string | null => (providerPool === null ? null : JSON.stringify(providerPool));

type InsertWorkspaceParams = {
  readonly db: Database;
  readonly workspace: Workspace;
};

export const insertWorkspace = async ({ db, workspace }: InsertWorkspaceParams): Promise<void> => {
  const createdAt = Date.parse(workspace.createdAt);
  const updatedAt = Date.parse(workspace.updatedAt);
  const lastAccessedAt =
    workspace.lastAccessedAt === undefined ? updatedAt : Date.parse(workspace.lastAccessedAt);
  await db.execute(
    `INSERT INTO workspaces (
       id, name, slug, default_provider_id,
       default_branch_prefix, default_verbosity, provider_bindings,
       task_models, role_models, parallel_agents, provider_pool, created_at, updated_at,
       deleted_at, disconnected_at, last_accessed_at, attribution_footer,
       ${REPLY_SETTING_COLUMNS}
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workspace.id,
      workspace.name,
      workspace.slug,
      workspace.overrides.defaultProviderId,
      workspace.overrides.defaultBranchPrefix,
      workspace.overrides.defaultVerbosity,
      serializeObject({ value: workspace.overrides.providerBindings }),
      serializeObject({ value: workspace.overrides.taskModels }),
      serializeObject({ value: workspace.overrides.roleModels }),
      workspace.overrides.parallelAgents === null
        ? null
        : workspace.overrides.parallelAgents
          ? 1
          : 0,
      serializeProviderPool({ providerPool: workspace.overrides.providerPool }),
      createdAt,
      updatedAt,
      workspace.deletedAt === undefined ? null : Date.parse(workspace.deletedAt),
      workspace.disconnectedAt === undefined ? null : Date.parse(workspace.disconnectedAt),
      lastAccessedAt,
      workspace.overrides.attributionFooter === null
        ? null
        : workspace.overrides.attributionFooter
          ? 1
          : 0,
      ...replySettingValues({ overrides: workspace.overrides }),
    ],
  );
  if (workspace.profile === undefined) {
    return;
  }
  await upsertWorkspaceProfile({ db, workspaceId: workspace.id, profile: workspace.profile });
};

type GetWorkspaceParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
};

export const getWorkspaceById = async ({
  db,
  id,
}: GetWorkspaceParams): Promise<Workspace | null> => {
  const rows = await db.select<WorkspaceRow>(`${WORKSPACE_SELECT} WHERE w.id = ?`, [id]);
  const row = rows[0];
  return row === undefined ? null : toDomain({ row });
};

type ListWorkspacesParams = {
  readonly db: Database;
};

export const listWorkspaces = async ({
  db,
}: ListWorkspacesParams): Promise<ReadonlyArray<Workspace>> => {
  const rows = await db.select<WorkspaceRow>(
    `${WORKSPACE_SELECT}
     WHERE w.deleted_at IS NULL AND w.disconnected_at IS NULL
     ORDER BY w.created_at DESC`,
  );
  return rows.map((row) => toDomain({ row }));
};

type WorkspaceTimestampParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
  readonly at: IsoDateTime;
};

export const disconnectWorkspace = async ({
  db,
  id,
  at,
}: WorkspaceTimestampParams): Promise<void> => {
  const timestamp = Date.parse(at);
  await db.execute('UPDATE workspaces SET disconnected_at = ?, updated_at = ? WHERE id = ?', [
    timestamp,
    timestamp,
    id,
  ]);
};

type DisconnectWorkspaceAndProjectsParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
  readonly projectIds: ReadonlyArray<string>;
  readonly at: IsoDateTime;
};

export const disconnectWorkspaceAndProjects = async ({
  db,
  id,
  projectIds,
  at,
}: DisconnectWorkspaceAndProjectsParams): Promise<void> => {
  const timestamp = Date.parse(at);
  const outcome = await db.transaction({
    statements: [
      {
        sql: 'UPDATE workspaces SET disconnected_at = ?, updated_at = ? WHERE id = ?',
        params: [timestamp, timestamp, id],
      },
      ...projectIds.map((projectId) => ({
        sql: 'UPDATE projects SET disconnected_at = ?, updated_at = ? WHERE id = ?',
        params: [timestamp, timestamp, projectId],
      })),
    ],
  });
  if (outcome.status === 'aborted') {
    throw new Error(
      'The workspace could not be disconnected because the database rejected the write.',
    );
  }
};

export const reconnectWorkspace = async ({
  db,
  id,
  at,
}: WorkspaceTimestampParams): Promise<void> => {
  const timestamp = Date.parse(at);
  await db.execute(
    'UPDATE workspaces SET disconnected_at = NULL, updated_at = ?, last_accessed_at = ? WHERE id = ?',
    [timestamp, timestamp, id],
  );
};

type ReconnectWorkspaceAndProjectsParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
  readonly projectIds: ReadonlyArray<string>;
  readonly at: IsoDateTime;
};

export const reconnectWorkspaceAndProjects = async ({
  db,
  id,
  projectIds,
  at,
}: ReconnectWorkspaceAndProjectsParams): Promise<void> => {
  const timestamp = Date.parse(at);
  const outcome = await db.transaction({
    statements: [
      {
        sql: 'UPDATE workspaces SET disconnected_at = NULL, updated_at = ?, last_accessed_at = ? WHERE id = ?',
        params: [timestamp, timestamp, id],
      },
      ...projectIds.map((projectId) => ({
        sql: 'UPDATE projects SET disconnected_at = NULL, updated_at = ?, last_accessed_at = ? WHERE id = ?',
        params: [timestamp, timestamp, projectId],
      })),
    ],
  });
  if (outcome.status === 'aborted') {
    throw new Error(
      'The workspace could not be reconnected because the database rejected the write.',
    );
  }
};

type RenameWorkspaceParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
  readonly name: string;
};

export const renameWorkspace = async ({ db, id, name }: RenameWorkspaceParams): Promise<void> => {
  await db.execute('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?', [
    name,
    Date.now(),
    id,
  ]);
};

type WorkspaceIdParams = {
  readonly db: Database;
  readonly id: WorkspaceId;
};

export const touchWorkspaceLastAccessed = async ({ db, id }: WorkspaceIdParams): Promise<void> => {
  await db.execute('UPDATE workspaces SET last_accessed_at = ? WHERE id = ?', [Date.now(), id]);
};

export const deleteWorkspace = async ({ db, id }: WorkspaceIdParams): Promise<void> => {
  await db.execute('DELETE FROM workspaces WHERE id = ?', [id]);
};

type UpsertWorkspaceProfileParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly profile: WorkspaceProfile;
};

export const upsertWorkspaceProfile = async ({
  db,
  workspaceId,
  profile,
}: UpsertWorkspaceProfileParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspace_profiles (
       workspace_id, roles_json, about_work, working_rules, explain_more_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       roles_json = excluded.roles_json,
       about_work = excluded.about_work,
       working_rules = excluded.working_rules,
       explain_more_json = excluded.explain_more_json,
       updated_at = excluded.updated_at`,
    [
      workspaceId,
      profile.roles.length === 0 ? null : JSON.stringify(profile.roles),
      profile.aboutWork,
      profile.workingRules,
      profile.explainMore.length === 0 ? null : JSON.stringify(profile.explainMore),
      Date.now(),
    ],
  );
};
