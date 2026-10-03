import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  MountPullRequestState,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonValue, parseJsonColumn } from '../shared/parseJsonColumn';

export type MountPullRequestLinkRow = {
  readonly id: string;
  readonly mountId: MountId;
  readonly provider: MountPullRequestLink['provider'];
  readonly host: string;
  readonly repoSlug: string;
  readonly prNumber: number;
  readonly headBranch: string;
  readonly baseBranch: string | null;
  readonly url: string;
  readonly state: MountPullRequestState;
  readonly snapshot: string;
  readonly mergedHeadSha: string | null;
  readonly mergedAt: number | null;
  readonly lastObservedAt: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type ListMountPullRequestLinksParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type UpsertMountPullRequestLinkParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly link: MountPullRequestLink;
};

export const MOUNT_PR_LINK_COLUMNS = `link.id, link.mount_id AS mountId, link.provider, link.host,
  link.repo_slug AS repoSlug, link.pr_number AS prNumber,
  link.head_branch AS headBranch, link.base_branch AS baseBranch,
  link.url, link.state, link.snapshot_json AS snapshot,
  link.merged_head_sha AS mergedHeadSha, link.merged_at AS mergedAt,
  link.last_observed_at AS lastObservedAt,
  link.created_at AS createdAt, link.updated_at AS updatedAt`;

export const toMountPullRequestLink = (row: MountPullRequestLinkRow): MountPullRequestLink => ({
  ...row,
  snapshot: parseJsonColumn({ value: row.snapshot, isValid: isJsonValue, fallback: null }),
  mergedHeadSha: row.mergedHeadSha ?? null,
  mergedAt: row.mergedAt == null ? null : (new Date(row.mergedAt).toISOString() as IsoDateTime),
  lastObservedAt: new Date(row.lastObservedAt).toISOString() as IsoDateTime,
  createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updatedAt).toISOString() as IsoDateTime,
});

export const upsertMountPullRequestLink = async ({
  db,
  sessionId,
  link,
}: UpsertMountPullRequestLinkParams): Promise<boolean> => {
  const result = await db.execute(
    `INSERT INTO mount_pr_links
      (id, mount_id, provider, host, repo_slug, pr_number, head_branch, base_branch,
       url, state, snapshot_json, merged_head_sha, merged_at,
       last_observed_at, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM session_worktrees WHERE session_id = ? AND id = ?
     )
     ON CONFLICT (mount_id, provider, host, repo_slug, pr_number) DO UPDATE SET
       head_branch = excluded.head_branch,
       base_branch = excluded.base_branch,
       url = excluded.url,
       state = excluded.state,
       snapshot_json = excluded.snapshot_json,
       merged_head_sha = COALESCE(excluded.merged_head_sha, mount_pr_links.merged_head_sha),
       merged_at = COALESCE(excluded.merged_at, mount_pr_links.merged_at),
       last_observed_at = excluded.last_observed_at,
       updated_at = excluded.updated_at`,
    [
      link.id,
      link.mountId,
      link.provider,
      link.host,
      link.repoSlug,
      link.prNumber,
      link.headBranch,
      link.baseBranch,
      link.url,
      link.state,
      JSON.stringify(link.snapshot) ?? 'null',
      link.mergedHeadSha ?? null,
      link.mergedAt == null ? null : Date.parse(link.mergedAt),
      Date.parse(link.lastObservedAt),
      Date.parse(link.createdAt),
      Date.parse(link.updatedAt),
      sessionId,
      link.mountId,
    ],
  );
  return result.rowsAffected > 0;
};

export const listMountPullRequestLinks = async ({
  db,
  sessionId,
  mountId,
}: ListMountPullRequestLinksParams): Promise<ReadonlyArray<MountPullRequestLink>> => {
  const rows = await db.select<MountPullRequestLinkRow>(
    `SELECT ${MOUNT_PR_LINK_COLUMNS}
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
     WHERE mount.session_id = ? AND mount.id = ?
     ORDER BY link.created_at, link.id`,
    [sessionId, mountId],
  );
  return rows.map(toMountPullRequestLink);
};

type ListMergedRequestHeadsParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
};

type MergedHeadRow = {
  readonly headBranch: string;
  readonly mergedHeadSha: string;
};

export const listMergedRequestHeads = async ({
  db,
  projectId,
}: ListMergedRequestHeadsParams): Promise<Readonly<Record<string, string>>> => {
  const rows = await db.select<MergedHeadRow>(
    `SELECT link.head_branch AS headBranch, link.merged_head_sha AS mergedHeadSha
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
     WHERE mount.project_id = ? AND link.state = 'merged' AND link.merged_head_sha IS NOT NULL
     ORDER BY COALESCE(link.merged_at, link.updated_at), link.id`,
    [projectId],
  );
  return Object.fromEntries(rows.map((row) => [row.headBranch, row.mergedHeadSha]));
};

type ListDormantOpenParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly limit: number;
};

type DormantPullRequestLink = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
  readonly link: MountPullRequestLink;
};

type DormantLinkRow = MountPullRequestLinkRow & {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
};

export const listDormantOpenPullRequests = async ({
  db,
  workspaceId,
  limit,
}: ListDormantOpenParams): Promise<ReadonlyArray<DormantPullRequestLink>> => {
  const rows = await db.select<DormantLinkRow>(
    `SELECT ${MOUNT_PR_LINK_COLUMNS}, mount.session_id AS sessionId, mount.project_id AS projectId
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
     JOIN sessions s ON s.id = mount.session_id
     WHERE s.workspace_id = ?
       AND (s.deleted_at IS NOT NULL OR s.archived_at IS NOT NULL)
       AND link.provider = 'github'
       AND link.state NOT IN ('merged', 'closed')
     ORDER BY link.last_observed_at ASC, link.id
     LIMIT ?`,
    [workspaceId, limit],
  );
  return rows.map(({ sessionId, projectId, ...row }) => ({
    sessionId,
    projectId,
    link: toMountPullRequestLink(row),
  }));
};
