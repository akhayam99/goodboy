import type { Database } from '../client';

type Params = {
  readonly db: Database;
};

type MergedLinkRow = {
  readonly session_id: string;
  readonly mount_id: string;
  readonly project_id: string | null;
  readonly provider: string;
  readonly host: string;
  readonly repo_slug: string;
  readonly pr_number: number;
  readonly head_branch: string;
  readonly url: string;
  readonly title: string | null;
  readonly merged_at: number;
};

export const backfillMergedPullRequestEvents = async ({ db }: Params): Promise<number> => {
  const rows = await db.select<MergedLinkRow>(
    `SELECT
       mount.session_id AS session_id,
       link.mount_id AS mount_id,
       mount.project_id AS project_id,
       link.provider AS provider,
       link.host AS host,
       link.repo_slug AS repo_slug,
       link.pr_number AS pr_number,
       link.head_branch AS head_branch,
       link.url AS url,
       CASE WHEN json_valid(link.snapshot_json)
         THEN json_extract(link.snapshot_json, '$.title') END AS title,
       COALESCE(link.merged_at, link.updated_at) AS merged_at
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
    WHERE link.state = 'merged'
      AND NOT EXISTS (
        SELECT 1
          FROM session_events e
         WHERE e.session_id = mount.session_id
           AND e.kind = 'pr_merged'
           AND json_valid(e.payload_json)
           AND CAST(json_extract(e.payload_json, '$.number') AS INTEGER) = link.pr_number
           AND COALESCE(json_extract(e.payload_json, '$.repository'), link.repo_slug)
             = link.repo_slug
           AND COALESCE(json_extract(e.payload_json, '$.host'), link.host) = link.host
      )`,
  );
  const unique = [
    ...new Map(
      rows.map((row) => [`${row.session_id}:${row.host}:${row.repo_slug}:${row.pr_number}`, row]),
    ).values(),
  ];
  for (const row of unique) {
    await db.execute(
      `INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
       VALUES (?, ?, 'pr_merged', ?, ?)`,
      [
        crypto.randomUUID(),
        row.session_id,
        JSON.stringify({
          mountId: row.mount_id,
          ...(row.project_id === null ? {} : { projectId: row.project_id }),
          provider: row.provider,
          host: row.host,
          repository: row.repo_slug,
          number: row.pr_number,
          ...(row.title === null ? {} : { title: row.title }),
          url: row.url,
          branch: row.head_branch,
        }),
        row.merged_at,
      ],
    );
  }
  return unique.length;
};
