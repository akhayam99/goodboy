import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  MountPullRequestState,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

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

const parseSnapshot = ({ value }: { readonly value: string }): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const MOUNT_PR_LINK_COLUMNS = `link.id, link.mount_id AS mountId, link.provider, link.host,
  link.repo_slug AS repoSlug, link.pr_number AS prNumber,
  link.head_branch AS headBranch, link.base_branch AS baseBranch,
  link.url, link.state, link.snapshot_json AS snapshot,
  link.last_observed_at AS lastObservedAt,
  link.created_at AS createdAt, link.updated_at AS updatedAt`;

export const toMountPullRequestLink = (row: MountPullRequestLinkRow): MountPullRequestLink => ({
  ...row,
  snapshot: parseSnapshot({ value: row.snapshot }),
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
       url, state, snapshot_json, last_observed_at, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM session_worktrees WHERE session_id = ? AND id = ?
     )
     ON CONFLICT (mount_id, provider, host, repo_slug, pr_number) DO UPDATE SET
       head_branch = excluded.head_branch,
       base_branch = excluded.base_branch,
       url = excluded.url,
       state = excluded.state,
       snapshot_json = excluded.snapshot_json,
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
