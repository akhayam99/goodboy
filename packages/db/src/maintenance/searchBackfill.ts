import type { Database, Statement } from '../client';
import { docTouchesExcludedProjectSql } from '../shared/searchExclusion';

type BackfillSource = {
  readonly id: string;
  readonly table: string;
  readonly key: string;
  readonly isIntegerKey: boolean;
  readonly docId: string;
  readonly when?: string;
  readonly kind: string;
  readonly refId: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly agentId?: string;
  readonly mountId?: string;
  readonly projectId?: string;
  readonly provider?: string;
  readonly container?: string;
  readonly status?: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly body: string;
};

const NOW = `CAST(unixepoch('subsec') * 1000 AS INTEGER)`;

type JsonFieldParams = {
  readonly column: string;
  readonly path: string;
};

const jsonField = ({ column, path }: JsonFieldParams): string =>
  `CASE WHEN json_valid(${column}) THEN json_extract(${column}, '${path}') END`;

const SOURCES: ReadonlyArray<BackfillSource> = [
  {
    id: 'session',
    table: 'sessions',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'session:' || src.id`,
    kind: `'session'`,
    refId: 'src.id',
    workspaceId: 'src.workspace_id',
    sessionId: 'src.id',
    occurredAt: 'src.created_at',
    title: 'src.goal',
    body: `''`,
  },
  {
    id: 'message',
    table: 'messages',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'message:' || src.id`,
    when: `src.role IN ('user', 'assistant')`,
    kind: `'message'`,
    refId: 'src.id',
    sessionId: 'src.session_id',
    agentId: 'src.agent_id',
    status: 'src.role',
    occurredAt: 'src.created_at',
    title: `''`,
    body: 'src.content',
  },
  {
    id: 'agent',
    table: 'agents',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'agent:' || src.id`,
    kind: `'agent'`,
    refId: 'src.id',
    sessionId: 'src.session_id',
    agentId: 'src.id',
    occurredAt: `COALESCE(src.started_at, src.last_finished_at, ${NOW})`,
    title: 'src.name',
    body: `COALESCE(src.output_summary, '')`,
  },
  {
    id: 'artifact',
    table: 'session_artifacts',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'artifact:' || src.id`,
    kind: 'src.kind',
    refId: 'src.id',
    sessionId: 'src.session_id',
    agentId: 'src.agent_id',
    status: 'src.status',
    occurredAt: 'src.created_at',
    title: 'src.title',
    body: `CASE WHEN src.source_format = 'markdown' THEN src.source_text ELSE '' END`,
  },
  {
    id: 'decision',
    table: 'session_decisions',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'decision:' || src.id`,
    kind: `'decision'`,
    refId: 'src.id',
    sessionId: 'src.session_id',
    status: 'src.status',
    occurredAt: 'src.created_at',
    title: 'src.text',
    body: `COALESCE(src.why, '')`,
  },
  {
    id: 'question',
    table: 'open_questions',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'question:' || src.id`,
    kind: `'question'`,
    refId: 'src.id',
    sessionId: 'src.session_id',
    status: 'src.status',
    occurredAt: 'src.created_at',
    title: 'src.text',
    body: `COALESCE(src.user_answer, '')`,
  },
  {
    id: 'linked_issue',
    table: 'session_external_tasks',
    key: 'src.rowid',
    isIntegerKey: true,
    docId: `'task:' || src.session_id || ':' || src.provider || ':' || src.external_id`,
    kind: `'issue'`,
    refId: 'src.external_id',
    sessionId: 'src.session_id',
    provider: 'src.provider',
    container: 'src.identifier',
    occurredAt: 'src.created_at',
    title: `src.identifier || ' ' || src.title`,
    body: `''`,
  },
  {
    id: 'starred_issue',
    table: 'workspace_starred_issues',
    key: 'src.rowid',
    isIntegerKey: true,
    docId: `'starred:' || src.workspace_id || ':' || src.provider || ':' || src.external_id`,
    kind: `'issue'`,
    refId: 'src.external_id',
    workspaceId: 'src.workspace_id',
    provider: 'src.provider',
    container: 'src.identifier',
    status: 'src.state',
    occurredAt: 'src.starred_at',
    title: `src.identifier || ' ' || src.title`,
    body: `COALESCE(src.container, '')`,
  },
  {
    id: 'github_pr',
    table: 'github_pr_cache',
    key: 'src.rowid',
    isIntegerKey: true,
    docId: `'ghpr:' || src.repo_slug || ':' || src.branch`,
    when: `${jsonField({ column: 'src.pr_json', path: '$.number' })} IS NOT NULL`,
    kind: `'pr'`,
    refId: 'src.branch',
    provider: `'github'`,
    container: 'src.repo_slug',
    status: jsonField({ column: 'src.pr_json', path: '$.state' }),
    occurredAt: 'src.fetched_at',
    title: `'#' || ${jsonField({ column: 'src.pr_json', path: '$.number' })} || ' ' || COALESCE(${jsonField({ column: 'src.pr_json', path: '$.title' })}, '')`,
    body: `src.branch || ' ' || src.repo_slug`,
  },
  {
    id: 'mount_pr',
    table: 'mount_pr_links',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'mountpr:' || src.id`,
    kind: `'pr'`,
    refId: 'src.id',
    mountId: 'src.mount_id',
    provider: 'src.provider',
    container: 'src.repo_slug',
    status: 'src.state',
    occurredAt: 'src.created_at',
    title: `'#' || src.pr_number || ' ' || COALESCE(${jsonField({ column: 'src.snapshot_json', path: '$.title' })}, '')`,
    body: `src.head_branch || ' ' || src.repo_slug`,
  },
  {
    id: 'branch',
    table: 'session_worktrees',
    key: 'src.id',
    isIntegerKey: false,
    docId: `'branch:' || src.id`,
    kind: `'branch'`,
    refId: 'src.id',
    sessionId: 'src.session_id',
    mountId: 'src.id',
    projectId: 'src.project_id',
    container: 'src.repo_slug',
    status: `CASE WHEN src.is_attached = 1 THEN 'attached' ELSE 'detached' END`,
    occurredAt: 'src.created_at',
    title: 'src.branch',
    body: `COALESCE(src.mount_name, '')`,
  },
];

export const SEARCH_BACKFILL_BATCH = 200;

type StateRow = {
  readonly id: string;
  readonly cursor: string | null;
  readonly isDone: number;
};

type BatchRow = {
  readonly upper: string | number | null;
  readonly count: number;
};

type Cursor = string | number | null;

type CursorValueParams = {
  readonly source: BackfillSource;
  readonly cursor: string | null;
};

const cursorValue = ({ source, cursor }: CursorValueParams): Cursor => {
  if (cursor === null) {
    return null;
  }
  return source.isIntegerKey ? Number(cursor) : cursor;
};

type SourceParams = {
  readonly source: BackfillSource;
};

const rangeSql = ({ source }: SourceParams): string =>
  `(? IS NULL OR ${source.key} > ?) AND ${source.key} <= ?`;

const insertDocsSql = ({ source }: SourceParams): string => `
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
  project_id, provider, container, status, occurred_at, created_at, updated_at)
SELECT ${source.docId},
  (SELECT IFNULL(MAX(fts_rowid), 0) FROM search_docs) + ROW_NUMBER() OVER (ORDER BY ${source.key}),
  ${source.kind}, ${source.refId}, ${source.workspaceId ?? 'NULL'}, ${source.sessionId ?? 'NULL'},
  ${source.agentId ?? 'NULL'}, ${source.mountId ?? 'NULL'}, ${source.projectId ?? 'NULL'},
  ${source.provider ?? 'NULL'}, ${source.container ?? 'NULL'}, ${source.status ?? 'NULL'},
  ${source.occurredAt}, ?, ?
FROM ${source.table} src
WHERE ${rangeSql({ source })} AND ${source.when ?? '1'}
  AND NOT EXISTS (SELECT 1 FROM search_docs existing WHERE existing.id = ${source.docId})`;

const insertIndexSql = ({ source }: SourceParams): string => `
INSERT INTO search_index (rowid, title, body)
SELECT doc.fts_rowid, ${source.title}, ${source.body}
FROM ${source.table} src JOIN search_docs doc ON doc.id = ${source.docId}
WHERE ${rangeSql({ source })}
  AND NOT EXISTS (SELECT 1 FROM search_index fts WHERE fts.rowid = doc.fts_rowid)`;

const SAVE_STATE_SQL = `
INSERT INTO search_index_state (id, cursor, is_done, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET cursor = excluded.cursor, is_done = excluded.is_done,
  updated_at = excluded.updated_at`;

type DatabaseParams = {
  readonly db: Database;
};

const readStates = async ({ db }: DatabaseParams): Promise<ReadonlyMap<string, StateRow>> => {
  const rows = await db.select<StateRow>(
    'SELECT id, cursor, is_done AS isDone FROM search_index_state',
  );
  return new Map(rows.map((row) => [row.id, row]));
};

export type SearchBackfillStep = {
  readonly sourceId: string | null;
  readonly processed: number;
  readonly isDone: boolean;
};

type StepParams = {
  readonly db: Database;
  readonly now: number;
  readonly batchSize?: number;
};

export const runSearchBackfillStep = async ({
  db,
  now,
  batchSize = SEARCH_BACKFILL_BATCH,
}: StepParams): Promise<SearchBackfillStep> => {
  const states = await readStates({ db });
  const source = SOURCES.find((candidate) => states.get(candidate.id)?.isDone !== 1);
  if (source === undefined) {
    return { sourceId: null, processed: 0, isDone: true };
  }
  const lower = cursorValue({ source, cursor: states.get(source.id)?.cursor ?? null });
  const [batch] = await db.select<BatchRow>(
    `SELECT MAX(k) AS upper, COUNT(*) AS count FROM (
       SELECT ${source.key} AS k FROM ${source.table} src
       WHERE (? IS NULL OR ${source.key} > ?) ORDER BY ${source.key} LIMIT ?
     )`,
    [lower, lower, batchSize],
  );
  const count = batch?.count ?? 0;
  const upper = batch?.upper ?? null;
  const isSourceDone = count < batchSize;
  const range = [lower, lower, upper];
  const statements: ReadonlyArray<Statement> =
    count === 0 || upper === null
      ? []
      : [
          { sql: insertDocsSql({ source }), params: [now, now, ...range] },
          { sql: insertIndexSql({ source }), params: range },
        ];
  await db.transaction({
    statements: [
      ...statements,
      {
        sql: SAVE_STATE_SQL,
        params: [source.id, upper === null ? null : String(upper), isSourceDone ? 1 : 0, now, now],
      },
    ],
  });
  const isLast = isSourceDone && SOURCES.at(-1)?.id === source.id;
  return { sourceId: source.id, processed: count, isDone: isLast };
};

export const purgeExcludedSearchDocs = async ({ db }: DatabaseParams): Promise<number> => {
  const result = await db.execute(
    `DELETE FROM search_docs WHERE EXISTS (SELECT 1 FROM search_excluded_projects)
       AND id IN (SELECT doc.id FROM search_docs doc WHERE ${docTouchesExcludedProjectSql({ doc: 'doc' })})`,
  );
  return result.rowsAffected;
};

export type SearchBackfillProgress = {
  readonly scanned: number;
  readonly total: number;
  readonly isDone: boolean;
};

type CountRow = {
  readonly count: number;
};

type ScannedCountParams = DatabaseParams & {
  readonly source: BackfillSource;
  readonly state: StateRow | undefined;
};

const scannedCount = async ({ db, source, state }: ScannedCountParams): Promise<number> => {
  if (state?.isDone === 1) {
    const [total] = await db.select<CountRow>(`SELECT COUNT(*) AS count FROM ${source.table} src`);
    return total?.count ?? 0;
  }
  const cursor = cursorValue({ source, cursor: state?.cursor ?? null });
  if (cursor === null) {
    return 0;
  }
  const [scanned] = await db.select<CountRow>(
    `SELECT COUNT(*) AS count FROM ${source.table} src WHERE ${source.key} <= ?`,
    [cursor],
  );
  return scanned?.count ?? 0;
};

export const readSearchBackfillProgress = async ({
  db,
}: DatabaseParams): Promise<SearchBackfillProgress> => {
  const states = await readStates({ db });
  const counts = await Promise.all(
    SOURCES.map(async (source) => {
      const [total] = await db.select<CountRow>(
        `SELECT COUNT(*) AS count FROM ${source.table} src`,
      );
      const scanned = await scannedCount({ db, source, state: states.get(source.id) });
      return { total: total?.count ?? 0, scanned };
    }),
  );
  const isDone = SOURCES.every((source) => states.get(source.id)?.isDone === 1);
  return {
    total: counts.reduce((sum, entry) => sum + entry.total, 0),
    scanned: counts.reduce((sum, entry) => sum + entry.scanned, 0),
    isDone,
  };
};

export const rebuildSearchIndex = async ({ db }: DatabaseParams): Promise<void> => {
  await db.transaction({
    statements: [
      { sql: 'DELETE FROM search_index' },
      { sql: 'DELETE FROM search_docs' },
      { sql: 'DELETE FROM search_index_state' },
    ],
  });
};
