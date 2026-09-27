type IndexedSource = {
  readonly name: string;
  readonly table: string;
  readonly docId: (row: 'NEW' | 'OLD') => string;
  readonly watched: string;
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

const DOC_COLUMNS = `id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at`;

const writeDoc = (source: IndexedSource): string => `
  INSERT INTO search_docs (${DOC_COLUMNS})
  SELECT ${source.docId('NEW')}, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    ${source.kind}, ${source.refId}, ${source.workspaceId ?? 'NULL'}, ${source.sessionId ?? 'NULL'},
    ${source.agentId ?? 'NULL'}, ${source.mountId ?? 'NULL'}, ${source.projectId ?? 'NULL'},
    ${source.provider ?? 'NULL'}, ${source.container ?? 'NULL'}, ${source.status ?? 'NULL'},
    ${source.occurredAt}, ${NOW}, ${NOW}
  WHERE ${source.when ?? '1'};
  INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, ${source.title}, ${source.body} FROM search_docs WHERE id = ${source.docId('NEW')};`;

const triggersFor = (source: IndexedSource): string => `
CREATE TRIGGER search_${source.name}_insert AFTER INSERT ON ${source.table} BEGIN
  DELETE FROM search_docs WHERE id = ${source.docId('NEW')};${writeDoc(source)}
END;

CREATE TRIGGER search_${source.name}_update AFTER UPDATE OF ${source.watched} ON ${source.table} BEGIN
  DELETE FROM search_docs WHERE id IN (${source.docId('OLD')}, ${source.docId('NEW')});${writeDoc(source)}
END;

CREATE TRIGGER search_${source.name}_delete AFTER DELETE ON ${source.table} BEGIN
  DELETE FROM search_docs WHERE id = ${source.docId('OLD')};
END;
`;

const jsonField = (column: string, path: string): string =>
  `CASE WHEN json_valid(${column}) THEN json_extract(${column}, '${path}') END`;

const SOURCES: ReadonlyArray<IndexedSource> = [
  {
    name: 'session',
    table: 'sessions',
    docId: (row) => `'session:' || ${row}.id`,
    watched: 'goal, workspace_id',
    kind: `'session'`,
    refId: 'NEW.id',
    workspaceId: 'NEW.workspace_id',
    sessionId: 'NEW.id',
    occurredAt: 'NEW.created_at',
    title: 'NEW.goal',
    body: `''`,
  },
  {
    name: 'message',
    table: 'messages',
    docId: (row) => `'message:' || ${row}.id`,
    watched: 'content, role',
    when: `NEW.role IN ('user', 'assistant')`,
    kind: `'message'`,
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    agentId: 'NEW.agent_id',
    status: 'NEW.role',
    occurredAt: 'NEW.created_at',
    title: `''`,
    body: 'NEW.content',
  },
  {
    name: 'agent',
    table: 'agents',
    docId: (row) => `'agent:' || ${row}.id`,
    watched: 'name, output_summary',
    kind: `'agent'`,
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    agentId: 'NEW.id',
    occurredAt: `COALESCE(NEW.started_at, NEW.last_finished_at, ${NOW})`,
    title: 'NEW.name',
    body: `COALESCE(NEW.output_summary, '')`,
  },
  {
    name: 'artifact',
    table: 'session_artifacts',
    docId: (row) => `'artifact:' || ${row}.id`,
    watched: 'title, source_text, status',
    kind: 'NEW.kind',
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    agentId: 'NEW.agent_id',
    status: 'NEW.status',
    occurredAt: 'NEW.created_at',
    title: 'NEW.title',
    body: `CASE WHEN NEW.source_format = 'markdown' THEN NEW.source_text ELSE '' END`,
  },
  {
    name: 'decision',
    table: 'session_decisions',
    docId: (row) => `'decision:' || ${row}.id`,
    watched: 'text, why, status',
    kind: `'decision'`,
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    status: 'NEW.status',
    occurredAt: 'NEW.created_at',
    title: 'NEW.text',
    body: `COALESCE(NEW.why, '')`,
  },
  {
    name: 'question',
    table: 'open_questions',
    docId: (row) => `'question:' || ${row}.id`,
    watched: 'text, user_answer, status',
    kind: `'question'`,
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    status: 'NEW.status',
    occurredAt: 'NEW.created_at',
    title: 'NEW.text',
    body: `COALESCE(NEW.user_answer, '')`,
  },
  {
    name: 'linked_issue',
    table: 'session_external_tasks',
    docId: (row) =>
      `'task:' || ${row}.session_id || ':' || ${row}.provider || ':' || ${row}.external_id`,
    watched: 'session_id, provider, external_id, identifier, title',
    kind: `'issue'`,
    refId: 'NEW.external_id',
    sessionId: 'NEW.session_id',
    provider: 'NEW.provider',
    container: 'NEW.identifier',
    occurredAt: 'NEW.created_at',
    title: `NEW.identifier || ' ' || NEW.title`,
    body: `''`,
  },
  {
    name: 'starred_issue',
    table: 'workspace_starred_issues',
    docId: (row) =>
      `'starred:' || ${row}.workspace_id || ':' || ${row}.provider || ':' || ${row}.external_id`,
    watched: 'identifier, title, state, container',
    kind: `'issue'`,
    refId: 'NEW.external_id',
    workspaceId: 'NEW.workspace_id',
    provider: 'NEW.provider',
    container: 'NEW.identifier',
    status: 'NEW.state',
    occurredAt: 'NEW.starred_at',
    title: `NEW.identifier || ' ' || NEW.title`,
    body: `COALESCE(NEW.container, '')`,
  },
  {
    name: 'github_pr',
    table: 'github_pr_cache',
    docId: (row) => `'ghpr:' || ${row}.repo_slug || ':' || ${row}.branch`,
    watched: 'pr_json',
    when: `${jsonField('NEW.pr_json', '$.number')} IS NOT NULL`,
    kind: `'pr'`,
    refId: 'NEW.branch',
    provider: `'github'`,
    container: 'NEW.repo_slug',
    status: jsonField('NEW.pr_json', '$.state'),
    occurredAt: 'NEW.fetched_at',
    title: `'#' || ${jsonField('NEW.pr_json', '$.number')} || ' ' || COALESCE(${jsonField('NEW.pr_json', '$.title')}, '')`,
    body: `NEW.branch || ' ' || NEW.repo_slug`,
  },
  {
    name: 'mount_pr',
    table: 'mount_pr_links',
    docId: (row) => `'mountpr:' || ${row}.id`,
    watched: 'pr_number, head_branch, state, snapshot_json',
    kind: `'pr'`,
    refId: 'NEW.id',
    mountId: 'NEW.mount_id',
    provider: 'NEW.provider',
    container: 'NEW.repo_slug',
    status: 'NEW.state',
    occurredAt: 'NEW.created_at',
    title: `'#' || NEW.pr_number || ' ' || COALESCE(${jsonField('NEW.snapshot_json', '$.title')}, '')`,
    body: `NEW.head_branch || ' ' || NEW.repo_slug`,
  },
  {
    name: 'branch',
    table: 'session_worktrees',
    docId: (row) => `'branch:' || ${row}.id`,
    watched: 'branch, mount_name, project_id, repo_slug, is_attached',
    kind: `'branch'`,
    refId: 'NEW.id',
    sessionId: 'NEW.session_id',
    mountId: 'NEW.id',
    projectId: 'NEW.project_id',
    container: 'NEW.repo_slug',
    status: `CASE WHEN NEW.is_attached = 1 THEN 'attached' ELSE 'detached' END`,
    occurredAt: 'NEW.created_at',
    title: 'NEW.branch',
    body: `COALESCE(NEW.mount_name, '')`,
  },
];

export const m211SearchIndex = `
CREATE VIRTUAL TABLE search_index USING fts5(
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

CREATE TABLE search_docs (
  id TEXT PRIMARY KEY,
  fts_rowid INTEGER NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN (
    'session', 'message', 'agent', 'plan', 'report', 'wireframe',
    'decision', 'question', 'issue', 'pr', 'branch'
  )),
  ref_id TEXT NOT NULL,
  workspace_id TEXT NULL,
  session_id TEXT NULL,
  agent_id TEXT NULL,
  mount_id TEXT NULL,
  project_id TEXT NULL,
  provider TEXT NULL,
  container TEXT NULL,
  status TEXT NULL,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (mount_id) REFERENCES session_worktrees(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_search_docs_kind ON search_docs(kind);
CREATE INDEX idx_search_docs_workspace ON search_docs(workspace_id);
CREATE INDEX idx_search_docs_session ON search_docs(session_id);
CREATE INDEX idx_search_docs_agent ON search_docs(agent_id);
CREATE INDEX idx_search_docs_mount ON search_docs(mount_id);
CREATE INDEX idx_search_docs_project ON search_docs(project_id);
CREATE INDEX idx_search_docs_occurred ON search_docs(occurred_at);

CREATE TRIGGER search_docs_delete AFTER DELETE ON search_docs BEGIN
  DELETE FROM search_index WHERE rowid = OLD.fts_rowid;
END;

CREATE TABLE search_index_state (
  id TEXT PRIMARY KEY,
  cursor TEXT NULL,
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE search_excluded_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
${SOURCES.map(triggersFor).join('')}`;
