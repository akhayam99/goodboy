import {
  isSearchKind,
  type AgentId,
  type IsoDateTime,
  type MarkedSegment,
  type MountId,
  type ProjectId,
  type SearchHit,
  type SearchIndexStatus,
  type SearchQuery,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { readSearchBackfillProgress } from '../maintenance/searchBackfill';
import { docTouchesExcludedProjectSql } from '../shared/searchExclusion';

const MARK_OPEN = '\uE000';
const MARK_CLOSE = '\uE001';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNIPPET_TOKENS = 18;
const MAX_TOKENS = 12;

type TextParams = {
  readonly text: string;
};

export const searchTokens = ({ text }: TextParams): ReadonlyArray<string> =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, MAX_TOKENS);

export const toMatchExpression = ({ text }: TextParams): string | null => {
  const tokens = searchTokens({ text });
  if (tokens.length === 0) {
    return null;
  }
  return tokens.map((token) => `"${token}"*`).join(' ');
};

export const parseMarkedText = ({ text }: TextParams): ReadonlyArray<MarkedSegment> => {
  const segments: MarkedSegment[] = [];
  const parts = text.split(MARK_OPEN);
  for (const [index, part] of parts.entries()) {
    if (index === 0) {
      segments.push({ text: part, isMatch: false });
      continue;
    }
    const [marked = '', ...rest] = part.split(MARK_CLOSE);
    segments.push({ text: marked, isMatch: true });
    segments.push({ text: rest.join(''), isMatch: false });
  }
  return segments.filter((segment) => segment.text.length > 0);
};

type HitRow = {
  readonly docId: string;
  readonly ftsRowid: number;
  readonly kind: string;
  readonly refId: string;
  readonly workspaceId: string | null;
  readonly sessionId: string | null;
  readonly sessionTitle: string | null;
  readonly agentId: string | null;
  readonly agentName: string | null;
  readonly mountId: string | null;
  readonly provider: string | null;
  readonly container: string | null;
  readonly status: string | null;
  readonly isArchived: number;
  readonly occurredAt: number;
};

type MarkRow = {
  readonly rowid: number;
  readonly title: string;
  readonly snippet: string;
};

const OWNER_SESSION = `COALESCE(
  d.session_id,
  mw.session_id,
  CASE WHEN d.kind = 'pr' AND d.mount_id IS NULL THEN (
    SELECT gw.session_id FROM session_worktrees gw
    WHERE gw.repo_slug = d.container AND gw.branch = d.ref_id
    ORDER BY gw.created_at DESC LIMIT 1
  ) END
)`;

const EFFECTIVE_STATUS = `CASE
  WHEN d.kind = 'session' AND s.archived_at IS NOT NULL THEN 'archived'
  WHEN d.kind = 'session' THEN s.state_kind
  WHEN d.kind = 'agent' THEN a.status
  ELSE d.status
END`;

const EFFECTIVE_PROVIDER = 'COALESCE(d.provider, pr.provider, a.provider_override)';

type Clause = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

type ListParams = {
  readonly values: ReadonlyArray<unknown>;
};

const placeholders = ({ values }: ListParams): string => values.map(() => '?').join(', ');

type FilterParams = {
  readonly query: SearchQuery;
  readonly hasExclusions: boolean;
};

const filterClauses = ({ query, hasExclusions }: FilterParams): ReadonlyArray<Clause> => {
  const clauses: Clause[] = [
    {
      sql: '(d.owner_session_id IS NULL OR (s.id IS NOT NULL AND s.deleted_at IS NULL))',
      params: [],
    },
    { sql: '(d.agent_id IS NULL OR a.id IS NOT NULL)', params: [] },
    { sql: '(ws.id IS NULL OR ws.deleted_at IS NULL)', params: [] },
  ];
  if (hasExclusions) {
    clauses.push({ sql: `NOT ${docTouchesExcludedProjectSql({ doc: 'd' })}`, params: [] });
  }
  if (query.archived === 'exclude') {
    clauses.push({ sql: 's.archived_at IS NULL', params: [] });
  }
  if (query.archived === 'only') {
    clauses.push({ sql: 's.archived_at IS NOT NULL', params: [] });
  }
  if (query.kinds.length > 0) {
    clauses.push({
      sql: `d.kind IN (${placeholders({ values: query.kinds })})`,
      params: query.kinds,
    });
  }
  if (query.workspaceId !== null) {
    clauses.push({ sql: 'ws.id = ?', params: [query.workspaceId] });
  }
  if (query.sessionId !== null) {
    clauses.push({ sql: 'd.owner_session_id = ?', params: [query.sessionId] });
  }
  if (query.projectIds.length > 0) {
    const list = placeholders({ values: query.projectIds });
    clauses.push({
      sql: `(d.project_id IN (${list})
        OR s.active_project_id IN (${list})
        OR d.owner_session_id IN (SELECT session_id FROM session_worktrees WHERE project_id IN (${list})))`,
      params: [...query.projectIds, ...query.projectIds, ...query.projectIds],
    });
  }
  if (query.providers.length > 0) {
    clauses.push({
      sql: `${EFFECTIVE_PROVIDER} IN (${placeholders({ values: query.providers })})`,
      params: query.providers,
    });
  }
  const statuses = query.statuses.filter((status) => status !== 'archived');
  if (statuses.length > 0) {
    clauses.push({
      sql: `${EFFECTIVE_STATUS} IN (${placeholders({ values: statuses })})`,
      params: statuses,
    });
  }
  if (query.after !== null) {
    clauses.push({ sql: 'd.occurred_at >= ?', params: [query.after] });
  }
  if (query.before !== null) {
    clauses.push({ sql: 'd.occurred_at < ?', params: [query.before] });
  }
  return clauses;
};

const SELECTED = `d.id AS docId, d.fts_rowid AS ftsRowid, d.kind, d.ref_id AS refId,
  ws.id AS workspaceId, d.owner_session_id AS sessionId, s.goal AS sessionTitle,
  d.agent_id AS agentId, a.name AS agentName, d.mount_id AS mountId,
  ${EFFECTIVE_PROVIDER} AS provider, d.container, ${EFFECTIVE_STATUS} AS status,
  CASE WHEN s.archived_at IS NOT NULL THEN 1 ELSE 0 END AS isArchived,
  d.occurred_at AS occurredAt`;

const JOINS = `LEFT JOIN sessions s ON s.id = d.owner_session_id
  LEFT JOIN live_agents a ON a.id = d.agent_id
  LEFT JOIN provider_runs pr ON pr.id = a.provider_run_id
  LEFT JOIN workspaces ws ON ws.id = COALESCE(d.workspace_id, s.workspace_id)`;

type SearchParams = {
  readonly db: Database;
  readonly query: SearchQuery;
  readonly now: number;
};

type DatabaseParams = {
  readonly db: Database;
};

const hasExcludedProjects = async ({ db }: DatabaseParams): Promise<boolean> => {
  const rows = await db.select<CountRow>('SELECT COUNT(*) AS count FROM search_excluded_projects');
  return (rows[0]?.count ?? 0) > 0;
};

type ToHitParams = {
  readonly row: HitRow;
  readonly marks: MarkRow | undefined;
};

const toHit = ({ row, marks }: ToHitParams): SearchHit | null => {
  if (!isSearchKind(row.kind)) {
    return null;
  }
  return {
    docId: row.docId,
    kind: row.kind,
    refId: row.refId,
    workspaceId: row.workspaceId as WorkspaceId | null,
    sessionId: row.sessionId as SessionId | null,
    sessionTitle: row.sessionTitle,
    agentId: row.agentId as AgentId | null,
    agentName: row.agentName,
    mountId: row.mountId as MountId | null,
    provider: row.provider,
    container: row.container,
    status: row.status,
    isArchived: row.isArchived === 1,
    occurredAt: new Date(row.occurredAt).toISOString() as IsoDateTime,
    title: parseMarkedText({ text: marks?.title ?? '' }),
    snippet: parseMarkedText({ text: marks?.snippet ?? '' }),
  };
};

type MarksParams = {
  readonly db: Database;
  readonly match: string | null;
  readonly rowids: ReadonlyArray<number>;
};

const readMarks = async ({
  db,
  match,
  rowids,
}: MarksParams): Promise<ReadonlyMap<number, MarkRow>> => {
  if (rowids.length === 0) {
    return new Map();
  }
  const list = placeholders({ values: rowids });
  const rows =
    match === null
      ? await db.select<MarkRow>(
          `SELECT rowid, title, substr(body, 1, 160) AS snippet FROM search_index WHERE rowid IN (${list})`,
          rowids,
        )
      : await db.select<MarkRow>(
          `SELECT rowid,
             highlight(search_index, 0, char(57344), char(57345)) AS title,
             snippet(search_index, 1, char(57344), char(57345), '…', ${SNIPPET_TOKENS}) AS snippet
           FROM search_index WHERE search_index MATCH ? AND rowid IN (${list})`,
          [match, ...rowids],
        );
  return new Map(rows.map((row) => [row.rowid, row]));
};

export const searchIndex = async ({
  db,
  query,
  now,
}: SearchParams): Promise<ReadonlyArray<SearchHit>> => {
  const match = toMatchExpression({ text: query.text });
  const hasExclusions = await hasExcludedProjects({ db });
  const clauses = filterClauses({ query, hasExclusions });
  const where = clauses.map((clause) => clause.sql).join('\n  AND ');
  const filterParams = clauses.flatMap((clause) => clause.params);
  const docsCte =
    match === null
      ? `SELECT d.*, 0.0 AS score, ${OWNER_SESSION} AS owner_session_id
         FROM search_docs d LEFT JOIN session_worktrees mw ON mw.id = d.mount_id`
      : `SELECT d.*, m.score, ${OWNER_SESSION} AS owner_session_id
         FROM (SELECT rowid, bm25(search_index, 4.0, 1.0) AS score FROM search_index WHERE search_index MATCH ?) m
         JOIN search_docs d ON d.fts_rowid = m.rowid
         LEFT JOIN session_worktrees mw ON mw.id = d.mount_id`;
  const order =
    match === null
      ? 'd.occurred_at DESC'
      : `d.score * (1.0 + 0.5 / (1.0 + MAX(0, ? - d.occurred_at) / ${WEEK_MS}.0)) ASC, d.occurred_at DESC`;
  const rows = await db.select<HitRow>(
    `WITH d AS (${docsCte})
     SELECT ${SELECTED}
     FROM d
     ${JOINS}
     WHERE ${where}
     ORDER BY ${order}
     LIMIT ?`,
    [
      ...(match === null ? [] : [match]),
      ...filterParams,
      ...(match === null ? [] : [now]),
      query.limit,
    ],
  );
  const marks = await readMarks({ db, match, rowids: rows.map((row) => row.ftsRowid) });
  return rows.flatMap((row) => {
    const hit = toHit({ row, marks: marks.get(row.ftsRowid) });
    return hit === null ? [] : [hit];
  });
};

type SizeRow = {
  readonly bytes: number | null;
};

type CountRow = {
  readonly count: number;
};

type ExcludedRow = {
  readonly projectId: ProjectId;
};

export const readSearchIndexStatus = async ({ db }: DatabaseParams): Promise<SearchIndexStatus> => {
  const [size] = await db.select<SizeRow>(
    `SELECT SUM(pgsize) AS bytes FROM dbstat
     WHERE name LIKE 'search\\_%' ESCAPE '\\' OR name LIKE 'idx\\_search\\_%' ESCAPE '\\'
       OR name LIKE 'sqlite\\_autoindex\\_search\\_%' ESCAPE '\\'`,
  );
  const [docs] = await db.select<CountRow>('SELECT COUNT(*) AS count FROM search_docs');
  const excluded = await db.select<ExcludedRow>(
    'SELECT project_id AS projectId FROM search_excluded_projects ORDER BY created_at',
  );
  const progress = await readSearchBackfillProgress({ db });
  return {
    docs: docs?.count ?? 0,
    bytes: size?.bytes ?? 0,
    scanned: progress.scanned,
    total: progress.total,
    isBackfillDone: progress.isDone,
    excludedProjectIds: excluded.map((row) => row.projectId),
  };
};

type ProjectExclusionParams = DatabaseParams & {
  readonly projectId: ProjectId;
  readonly now: number;
};

export const excludeProjectFromSearch = async ({
  db,
  projectId,
  now,
}: ProjectExclusionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO search_excluded_projects (id, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO NOTHING`,
    [projectId, projectId, now, now],
  );
  await db.execute(
    `DELETE FROM search_docs WHERE id IN (
       SELECT d.id FROM search_docs d WHERE ${docTouchesExcludedProjectSql({ doc: 'd' })}
     )`,
  );
};

export const includeProjectInSearch = async ({
  db,
  projectId,
}: Omit<ProjectExclusionParams, 'now'>): Promise<void> => {
  await db.transaction({
    statements: [
      { sql: 'DELETE FROM search_excluded_projects WHERE project_id = ?', params: [projectId] },
      { sql: 'DELETE FROM search_index_state' },
    ],
  });
};
