import type {
  IsoDateTime,
  SessionExternalTaskProvider,
  StarredIssue,
  StarredIssueState,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly container: string | null;
  readonly title: string;
  readonly url: string;
  readonly state: StarredIssueState;
  readonly stateLabel: string | null;
  readonly starredAt: number;
  readonly refreshedAt: number | null;
};

const COLUMNS = `workspace_id AS workspaceId, provider, external_id AS externalId, identifier,
  container, title, url, state, state_label AS stateLabel, starred_at AS starredAt,
  refreshed_at AS refreshedAt`;

const toIso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const toDomain = (row: Row): StarredIssue => ({
  ...row,
  starredAt: toIso(row.starredAt),
  refreshedAt: row.refreshedAt === null ? null : toIso(row.refreshedAt),
});

type WorkspaceParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listStarredIssues = async ({
  db,
  workspaceId,
}: WorkspaceParams): Promise<ReadonlyArray<StarredIssue>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM workspace_starred_issues WHERE workspace_id = ?
     ORDER BY starred_at DESC, external_id`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type StarIssueParams = {
  readonly db: Database;
  readonly issue: StarredIssue;
};

export const starIssue = async ({ db, issue }: StarIssueParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspace_starred_issues
       (workspace_id, provider, external_id, identifier, container, title, url, state,
        state_label, starred_at, refreshed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, provider, external_id) DO UPDATE SET
       identifier = excluded.identifier, container = excluded.container, title = excluded.title,
       url = excluded.url, state = excluded.state, state_label = excluded.state_label`,
    [
      issue.workspaceId,
      issue.provider,
      issue.externalId,
      issue.identifier,
      issue.container,
      issue.title,
      issue.url,
      issue.state,
      issue.stateLabel,
      Date.parse(issue.starredAt),
      issue.refreshedAt === null ? null : Date.parse(issue.refreshedAt),
    ],
  );
};

type IssueKeyParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export const unstarIssue = async ({
  db,
  workspaceId,
  provider,
  externalId,
}: IssueKeyParams): Promise<void> => {
  await db.execute(
    'DELETE FROM workspace_starred_issues WHERE workspace_id = ? AND provider = ? AND external_id = ?',
    [workspaceId, provider, externalId],
  );
};

export const unstarClosedIssues = async ({
  db,
  workspaceId,
}: WorkspaceParams): Promise<ReadonlyArray<StarredIssue>> => {
  const closed = (await listStarredIssues({ db, workspaceId })).filter(
    (issue) => issue.state === 'done',
  );
  await db.execute(
    "DELETE FROM workspace_starred_issues WHERE workspace_id = ? AND state = 'done'",
    [workspaceId],
  );
  return closed;
};

type SnapshotParams = {
  readonly db: Database;
  readonly issues: ReadonlyArray<StarredIssue>;
};

export const updateStarredIssueSnapshots = async ({
  db,
  issues,
}: SnapshotParams): Promise<void> => {
  for (const issue of issues) {
    await db.execute(
      `UPDATE workspace_starred_issues
       SET identifier = ?, title = ?, url = ?, state = ?, state_label = ?, refreshed_at = ?
       WHERE workspace_id = ? AND provider = ? AND external_id = ?`,
      [
        issue.identifier,
        issue.title,
        issue.url,
        issue.state,
        issue.stateLabel,
        issue.refreshedAt === null ? null : Date.parse(issue.refreshedAt),
        issue.workspaceId,
        issue.provider,
        issue.externalId,
      ],
    );
  }
};
