import type {
  IsoDateTime,
  ProjectId,
  ProjectSentryLink,
  ProjectSentryLinkSource,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly sentryOrg: string;
  readonly sentryProject: string;
  readonly sentryProjectName: string | null;
  readonly source: ProjectSentryLinkSource;
  readonly createdAt: number;
};

const toDomain = (row: Row): ProjectSentryLink => ({
  ...row,
  createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
});

type ListParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listProjectSentryLinks = async ({
  db,
  workspaceId,
}: ListParams): Promise<ReadonlyArray<ProjectSentryLink>> => {
  const rows = await db.select<Row>(
    `SELECT l.id, l.workspace_id AS workspaceId, l.project_id AS projectId,
            l.sentry_org AS sentryOrg, l.sentry_project AS sentryProject,
            l.sentry_project_name AS sentryProjectName, l.source, l.created_at AS createdAt
     FROM project_sentry_links l
     JOIN projects p ON p.id = l.project_id
     WHERE l.workspace_id = ? AND p.disconnected_at IS NULL
     ORDER BY l.created_at, l.id`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type AddParams = {
  readonly db: Database;
  readonly link: ProjectSentryLink;
};

export const addProjectSentryLink = async ({ db, link }: AddParams): Promise<void> => {
  await db.execute(
    `INSERT INTO project_sentry_links
       (id, workspace_id, project_id, sentry_org, sentry_project, sentry_project_name, source,
        created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, sentry_org, sentry_project) DO UPDATE SET
       sentry_project_name = excluded.sentry_project_name`,
    [
      link.id,
      link.workspaceId,
      link.projectId,
      link.sentryOrg,
      link.sentryProject,
      link.sentryProjectName,
      link.source,
      Date.parse(link.createdAt),
    ],
  );
};

type RemoveParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
  readonly sentryOrg: string;
  readonly sentryProject: string;
};

export const removeProjectSentryLink = async ({
  db,
  projectId,
  sentryOrg,
  sentryProject,
}: RemoveParams): Promise<void> => {
  await db.execute(
    'DELETE FROM project_sentry_links WHERE project_id = ? AND sentry_org = ? AND sentry_project = ?',
    [projectId, sentryOrg, sentryProject],
  );
};
