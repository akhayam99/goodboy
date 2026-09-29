import type {
  IsoDateTime,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  MountPullRequestProvider,
  PrSeries,
  PrSeriesId,
  PrSeriesMember,
  PrSeriesMemberStatus,
  PrSeriesMembership,
  PrSeriesMemberView,
  PrSeriesView,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';
import {
  MOUNT_PR_LINK_COLUMNS,
  toMountPullRequestLink,
  type MountPullRequestLinkRow,
} from './mount-pr-link';
import { isJsonValue, parseJsonColumn } from '../shared/parseJsonColumn';

type SeriesRow = {
  readonly id: PrSeriesId;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly workItemIdentifier: string | null;
  readonly workItemUrl: string | null;
  readonly plannedCount: number | null;
  readonly parentRequest: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type MemberRow = {
  readonly id: PrSeriesMember['id'];
  readonly seriesId: PrSeriesId;
  readonly mountId: MountId | null;
  readonly branch: string | null;
  readonly ordinal: number;
  readonly label: string;
  readonly status: PrSeriesMemberStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type InsertPrSeriesParams = {
  readonly db: Database;
  readonly series: PrSeries;
};

type GetPrSeriesParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly seriesId: PrSeriesId;
};

type ListPrSeriesParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly projectId?: ProjectId;
};

type ListPrSeriesMembersParams = {
  readonly db: Database;
  readonly seriesId: PrSeriesId;
};

type UpsertPrSeriesMemberParams = {
  readonly db: Database;
  readonly member: PrSeriesMember;
};

type FindPrSeriesMembershipParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly branch: string;
};

const SERIES_COLUMNS = `id, session_id AS sessionId, project_id AS projectId, name,
    work_item_identifier AS workItemIdentifier, work_item_url AS workItemUrl,
    planned_count AS plannedCount, parent_request_json AS parentRequest,
    created_at AS createdAt, updated_at AS updatedAt`;

const MEMBER_COLUMNS = `id, series_id AS seriesId, mount_id AS mountId, branch, ordinal, label,
    status, created_at AS createdAt, updated_at AS updatedAt`;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIdentity = ({
  value,
}: {
  readonly value: string | null;
}): MountPullRequestIdentity | null => {
  const parsed = parseJsonColumn({ value, isValid: isJsonValue, fallback: null });
  if (!isRecord(parsed)) {
    return null;
  }
  const { provider, host, repoSlug, prNumber } = parsed;
  if (
    typeof provider !== 'string' ||
    typeof host !== 'string' ||
    typeof repoSlug !== 'string' ||
    typeof prNumber !== 'number'
  ) {
    return null;
  }
  return {
    provider: provider as MountPullRequestProvider,
    host,
    repoSlug,
    prNumber,
  };
};

const toSeries = (row: SeriesRow): PrSeries => ({
  ...row,
  parentRequest: parseIdentity({ value: row.parentRequest }),
  createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updatedAt).toISOString() as IsoDateTime,
});

const toMember = (row: MemberRow): PrSeriesMember => ({
  ...row,
  createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updatedAt).toISOString() as IsoDateTime,
});

const resolveRequest = ({
  member,
  links,
}: {
  readonly member: PrSeriesMember;
  readonly links: ReadonlyArray<MountPullRequestLink>;
}): MountPullRequestLink | null => {
  if (member.mountId === null || member.branch === null) {
    return null;
  }
  const matching = links.filter(
    (link) => link.mountId === member.mountId && link.headBranch === member.branch,
  );
  return matching[matching.length - 1] ?? null;
};

export const insertPrSeries = async ({ db, series }: InsertPrSeriesParams): Promise<void> => {
  await db.execute(
    `INSERT INTO pr_series
      (id, session_id, project_id, name, work_item_identifier, work_item_url, planned_count,
       parent_request_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      series.id,
      series.sessionId,
      series.projectId,
      series.name,
      series.workItemIdentifier,
      series.workItemUrl,
      series.plannedCount,
      series.parentRequest === null ? null : JSON.stringify(series.parentRequest),
      Date.parse(series.createdAt),
      Date.parse(series.updatedAt),
    ],
  );
};

export const getPrSeries = async ({
  db,
  sessionId,
  seriesId,
}: GetPrSeriesParams): Promise<PrSeries | null> => {
  const rows = await db.select<SeriesRow>(
    `SELECT ${SERIES_COLUMNS} FROM pr_series WHERE session_id = ? AND id = ? LIMIT 1`,
    [sessionId, seriesId],
  );
  const row = rows[0];
  return row === undefined ? null : toSeries(row);
};

export const listPrSeriesMembers = async ({
  db,
  seriesId,
}: ListPrSeriesMembersParams): Promise<ReadonlyArray<PrSeriesMember>> => {
  const rows = await db.select<MemberRow>(
    `SELECT ${MEMBER_COLUMNS} FROM pr_series_members WHERE series_id = ? ORDER BY ordinal`,
    [seriesId],
  );
  return rows.map(toMember);
};

export const listPrSeries = async ({
  db,
  sessionId,
  projectId,
}: ListPrSeriesParams): Promise<ReadonlyArray<PrSeriesView>> => {
  const seriesRows = await db.select<SeriesRow>(
    `SELECT ${SERIES_COLUMNS} FROM pr_series
     WHERE session_id = ? AND (? IS NULL OR project_id = ?)
     ORDER BY created_at, id`,
    [sessionId, projectId ?? null, projectId ?? null],
  );
  if (seriesRows.length === 0) {
    return [];
  }
  const linkRows = await db.select<MountPullRequestLinkRow>(
    `SELECT ${MOUNT_PR_LINK_COLUMNS}
     FROM mount_pr_links link
     JOIN session_worktrees mount ON mount.id = link.mount_id
     WHERE mount.session_id = ?
     ORDER BY link.created_at, link.id`,
    [sessionId],
  );
  const links = linkRows.map(toMountPullRequestLink);
  const seriesIds = seriesRows.map((row) => row.id);
  const memberRows = await db.select<MemberRow>(
    `SELECT ${MEMBER_COLUMNS} FROM pr_series_members
     WHERE series_id IN (${seriesIds.map(() => '?').join(', ')})
     ORDER BY series_id, ordinal`,
    seriesIds,
  );
  const membersBySeries = new Map<PrSeriesId, PrSeriesMember[]>();
  for (const row of memberRows) {
    const bucket = membersBySeries.get(row.seriesId) ?? [];
    bucket.push(toMember(row));
    membersBySeries.set(row.seriesId, bucket);
  }
  return seriesRows.map((row) => {
    const series = toSeries(row);
    const memberViews: ReadonlyArray<PrSeriesMemberView> = (
      membersBySeries.get(series.id) ?? []
    ).map((member) => ({
      ...member,
      request: resolveRequest({ member, links }),
    }));
    return { ...series, members: memberViews };
  });
};

export const upsertPrSeriesMember = async ({
  db,
  member,
}: UpsertPrSeriesMemberParams): Promise<void> => {
  await db.execute(
    `INSERT INTO pr_series_members
      (id, series_id, mount_id, branch, ordinal, label, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (series_id, ordinal) DO UPDATE SET
       mount_id = excluded.mount_id,
       branch = excluded.branch,
       label = excluded.label,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [
      member.id,
      member.seriesId,
      member.mountId,
      member.branch,
      member.ordinal,
      member.label,
      member.status,
      Date.parse(member.createdAt),
      Date.parse(member.updatedAt),
    ],
  );
};

type MembershipRow = {
  readonly memberId: PrSeriesMember['id'];
  readonly memberSeriesId: PrSeriesId;
  readonly memberMountId: MountId | null;
  readonly memberBranch: string | null;
  readonly memberOrdinal: number;
  readonly memberLabel: string;
  readonly memberStatus: PrSeriesMemberStatus;
  readonly memberCreatedAt: number;
  readonly memberUpdatedAt: number;
  readonly seriesId: PrSeriesId;
  readonly seriesSessionId: SessionId;
  readonly seriesProjectId: ProjectId;
  readonly seriesName: string;
  readonly seriesWorkItemIdentifier: string | null;
  readonly seriesWorkItemUrl: string | null;
  readonly seriesPlannedCount: number | null;
  readonly seriesParentRequest: string | null;
  readonly seriesCreatedAt: number;
  readonly seriesUpdatedAt: number;
};

const MEMBERSHIP_COLUMNS = `member.id AS memberId, member.series_id AS memberSeriesId,
    member.mount_id AS memberMountId, member.branch AS memberBranch,
    member.ordinal AS memberOrdinal, member.label AS memberLabel, member.status AS memberStatus,
    member.created_at AS memberCreatedAt, member.updated_at AS memberUpdatedAt,
    series.id AS seriesId, series.session_id AS seriesSessionId,
    series.project_id AS seriesProjectId, series.name AS seriesName,
    series.work_item_identifier AS seriesWorkItemIdentifier,
    series.work_item_url AS seriesWorkItemUrl, series.planned_count AS seriesPlannedCount,
    series.parent_request_json AS seriesParentRequest,
    series.created_at AS seriesCreatedAt, series.updated_at AS seriesUpdatedAt`;

const toMembership = (row: MembershipRow): PrSeriesMembership => ({
  series: toSeries({
    id: row.seriesId,
    sessionId: row.seriesSessionId,
    projectId: row.seriesProjectId,
    name: row.seriesName,
    workItemIdentifier: row.seriesWorkItemIdentifier,
    workItemUrl: row.seriesWorkItemUrl,
    plannedCount: row.seriesPlannedCount,
    parentRequest: row.seriesParentRequest,
    createdAt: row.seriesCreatedAt,
    updatedAt: row.seriesUpdatedAt,
  }),
  member: toMember({
    id: row.memberId,
    seriesId: row.memberSeriesId,
    mountId: row.memberMountId,
    branch: row.memberBranch,
    ordinal: row.memberOrdinal,
    label: row.memberLabel,
    status: row.memberStatus,
    createdAt: row.memberCreatedAt,
    updatedAt: row.memberUpdatedAt,
  }),
});

export const findPrSeriesMembership = async ({
  db,
  sessionId,
  mountId,
  branch,
}: FindPrSeriesMembershipParams): Promise<PrSeriesMembership | null> => {
  const rows = await db.select<MembershipRow>(
    `SELECT ${MEMBERSHIP_COLUMNS}
     FROM pr_series_members member
     JOIN pr_series series ON series.id = member.series_id AND series.session_id = ?
     WHERE member.mount_id = ? AND member.branch = ? AND member.status != 'omitted'
     ORDER BY member.ordinal, member.id
     LIMIT 1`,
    [sessionId, mountId, branch],
  );
  const row = rows[0];
  return row === undefined ? null : toMembership(row);
};
