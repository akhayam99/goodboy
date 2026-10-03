import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

const ENTRY_LIMIT = 50;

const PULL_REQUEST_URL =
  /^https?:\/\/([^/]+)\/(.+?)\/(?:pull|merge_requests|pull-requests)\/(\d+)/i;

export type PullRequestEntry = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly spendUsd: number | null;
  readonly isDeleted: boolean;
};

export type PullRequestOutcomes = {
  readonly open: number;
  readonly merged: number;
  readonly closed: number;
  readonly previousOpen: number | null;
  readonly previousMerged: number | null;
  readonly entries: ReadonlyArray<PullRequestEntry>;
};

export type PullRequestFactRow = {
  readonly source: 'link' | 'event';
  readonly session_id: string;
  readonly goal: string;
  readonly is_deleted: number;
  readonly host: string | null;
  readonly repository: string | null;
  readonly number: number | null;
  readonly title: string | null;
  readonly url: string | null;
  readonly state: string;
  readonly happened_at: number;
  readonly session_spend: number | null;
};

type SelectParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

const SESSION_SPEND = `(SELECT SUM(tr.estimated_cost_usd)
           FROM telemetry_records tr
          WHERE tr.session_id = s.id)`;

export const selectPullRequestFacts = async ({
  db,
  workspaceId,
}: SelectParams): Promise<ReadonlyArray<PullRequestFactRow>> =>
  db.select<PullRequestFactRow>(
    `SELECT
       'link' AS source,
       s.id AS session_id,
       s.goal AS goal,
       CASE WHEN s.deleted_at IS NOT NULL THEN 1 ELSE 0 END AS is_deleted,
       link.host AS host,
       link.repo_slug AS repository,
       link.pr_number AS number,
       CASE WHEN json_valid(link.snapshot_json)
         THEN json_extract(link.snapshot_json, '$.title') END AS title,
       link.url AS url,
       link.state AS state,
       COALESCE(link.merged_at, link.updated_at) AS happened_at,
       ${SESSION_SPEND} AS session_spend
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
     JOIN sessions s ON s.id = mount.session_id
    WHERE s.workspace_id = ?
    UNION ALL
    SELECT
       'event' AS source,
       s.id AS session_id,
       s.goal AS goal,
       CASE WHEN s.deleted_at IS NOT NULL THEN 1 ELSE 0 END AS is_deleted,
       json_extract(e.payload_json, '$.host') AS host,
       json_extract(e.payload_json, '$.repository') AS repository,
       CAST(json_extract(e.payload_json, '$.number') AS INTEGER) AS number,
       json_extract(e.payload_json, '$.title') AS title,
       json_extract(e.payload_json, '$.url') AS url,
       CASE e.kind WHEN 'pr_merged' THEN 'merged' ELSE 'closed' END AS state,
       e.created_at AS happened_at,
       ${SESSION_SPEND} AS session_spend
     FROM session_events e
     JOIN sessions s ON s.id = e.session_id
    WHERE s.workspace_id = ?
      AND e.kind IN ('pr_merged', 'pr_closed')
      AND json_valid(e.payload_json)`,
    [workspaceId, workspaceId],
  );

type Identity = {
  readonly host: string | null;
  readonly repository: string | null;
  readonly number: number | null;
};

type IdentityParams = {
  readonly row: PullRequestFactRow;
};

const identityOf = ({ row }: IdentityParams): Identity => {
  const match = row.url === null ? null : PULL_REQUEST_URL.exec(row.url);
  const host = row.host ?? match?.[1] ?? null;
  const repository = row.repository ?? match?.[2] ?? null;
  const fromUrl = match?.[3] === undefined ? null : Number(match[3]);
  return { host, repository, number: row.number ?? fromUrl };
};

type FullKeyParams = {
  readonly identity: Identity;
};

const fullKeyOf = ({ identity }: FullKeyParams): string | null => {
  if (identity.host === null || identity.repository === null || identity.number === null) {
    return null;
  }
  return `${identity.host.toLowerCase()}/${identity.repository.toLowerCase()}#${identity.number}`;
};

type SessionNumberParams = {
  readonly sessionId: string;
  readonly number: number;
};

const sessionNumberKey = ({ sessionId, number }: SessionNumberParams): string =>
  `session:${sessionId}#${number}`;

export type PullRequestFact = {
  readonly key: string;
  readonly number: number;
  readonly state: string;
  readonly happenedAt: number;
  readonly entry: PullRequestEntry;
};

type GroupParams = {
  readonly facts: ReadonlyArray<PullRequestFactRow>;
};

const groupByPullRequest = ({
  facts,
}: GroupParams): ReadonlyMap<string, ReadonlyArray<PullRequestFactRow>> => {
  const identified = facts.flatMap((row) => {
    const identity = identityOf({ row });
    if (identity.number === null) {
      return [];
    }
    return [{ row, number: identity.number, fullKey: fullKeyOf({ identity }) }];
  });
  const knownBySession = new Map<string, string>();
  for (const item of identified) {
    if (item.fullKey === null) {
      continue;
    }
    knownBySession.set(
      sessionNumberKey({ sessionId: item.row.session_id, number: item.number }),
      item.fullKey,
    );
  }
  const groups = new Map<string, PullRequestFactRow[]>();
  for (const item of identified) {
    const fallback = sessionNumberKey({ sessionId: item.row.session_id, number: item.number });
    const key = item.fullKey ?? knownBySession.get(fallback) ?? fallback;
    groups.set(key, [...(groups.get(key) ?? []), { ...item.row, number: item.number }]);
  }
  return groups;
};

type PickParams = {
  readonly rows: ReadonlyArray<PullRequestFactRow>;
};

const latestOf = ({ rows }: PickParams): PullRequestFactRow | null =>
  rows.reduce<PullRequestFactRow | null>(
    (latest, row) => (latest === null || row.happened_at > latest.happened_at ? row : latest),
    null,
  );

const earliestOf = ({ rows }: PickParams): PullRequestFactRow | null =>
  rows.reduce<PullRequestFactRow | null>(
    (earliest, row) =>
      earliest === null || row.happened_at < earliest.happened_at ? row : earliest,
    null,
  );

const spendOf = ({ rows }: PickParams): number | null => {
  const bySession = new Map<string, number>();
  for (const row of rows) {
    bySession.set(row.session_id, row.session_spend ?? 0);
  }
  const total = [...bySession.values()].reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : null;
};

type FactParams = {
  readonly key: string;
  readonly rows: ReadonlyArray<PullRequestFactRow>;
};

const toFact = ({ key, rows }: FactParams): PullRequestFact | null => {
  const merged = earliestOf({ rows: rows.filter((row) => row.state === 'merged') });
  const latestLink = latestOf({ rows: rows.filter((row) => row.source === 'link') });
  const primary = merged ?? latestLink ?? latestOf({ rows });
  if (primary === null || primary.number === null) {
    return null;
  }
  const title =
    primary.title ?? rows.find((row) => row.title !== null)?.title ?? 'Untitled pull request';
  return {
    key,
    number: primary.number,
    state: primary.state,
    happenedAt: primary.happened_at,
    entry: {
      sessionId: primary.session_id as SessionId,
      goal: primary.goal,
      number: primary.number,
      title,
      state: primary.state,
      spendUsd: spendOf({ rows }),
      isDeleted: primary.is_deleted === 1,
    },
  };
};

export const collectPullRequestFacts = ({ facts }: GroupParams): ReadonlyArray<PullRequestFact> =>
  [...groupByPullRequest({ facts }).entries()].flatMap(([key, rows]) => {
    const fact = toFact({ key, rows });
    return fact === null ? [] : [fact];
  });

type SummaryParams = {
  readonly facts: ReadonlyArray<PullRequestFactRow>;
  readonly currentStart: number | null;
  readonly previousStart: number | null;
  readonly previousEnd: number | null;
};

type InWindowParams = {
  readonly fact: PullRequestFact;
  readonly start: number | null;
  readonly end: number | null;
};

const isInWindow = ({ fact, start, end }: InWindowParams): boolean =>
  (start === null || fact.happenedAt >= start) && (end === null || fact.happenedAt < end);

const isOpen = (fact: PullRequestFact): boolean =>
  fact.state !== 'merged' && fact.state !== 'closed';

export const summarizePullRequests = ({
  facts,
  currentStart,
  previousStart,
  previousEnd,
}: SummaryParams): PullRequestOutcomes => {
  const all = collectPullRequestFacts({ facts });
  const current = all
    .filter((fact) => isInWindow({ fact, start: currentStart, end: null }))
    .sort((left, right) => right.happenedAt - left.happenedAt);
  const previous =
    currentStart === null
      ? null
      : all.filter((fact) => isInWindow({ fact, start: previousStart, end: previousEnd }));
  return {
    open: current.filter(isOpen).length,
    merged: current.filter((fact) => fact.state === 'merged').length,
    closed: current.filter((fact) => fact.state === 'closed').length,
    previousOpen: previous === null ? null : previous.filter(isOpen).length,
    previousMerged:
      previous === null ? null : previous.filter((fact) => fact.state === 'merged').length,
    entries: current.slice(0, ENTRY_LIMIT).map((fact) => fact.entry),
  };
};
