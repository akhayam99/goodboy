export const m239ThreadReads = `
CREATE TABLE thread_reads (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, thread_id)
);

INSERT INTO thread_reads (id, session_id, thread_id, read_at, created_at, updated_at)
SELECT
  session_id || ':' || thread_id,
  session_id,
  thread_id,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM resolve_threads;
`;
