const EMPTY_TABLES: ReadonlyArray<string> = ['auto_artifacts', 'workspace_starred_issues'];

const IMPACT_FROM_SESSIONS = /\b(?:FROM|JOIN) sessions s\b/;
const IMPACT_WORKSPACE = /\bs\.workspace_id = \?/;
const IMPACT_AGGREGATE = /\b(?:COUNT|SUM|MAX|COALESCE|CASE)\b/;
const CONTEXT_GROWTH =
  /^SELECT tr\.recorded_at AS recorded_at, tr\.context_tokens AS context_tokens FROM telemetry_records tr JOIN sessions s\b/;

type Params = {
  readonly sql: string;
};

const isImpactRead = ({ sql }: Params): boolean =>
  CONTEXT_GROWTH.test(sql) ||
  (IMPACT_FROM_SESSIONS.test(sql) && IMPACT_WORKSPACE.test(sql) && IMPACT_AGGREGATE.test(sql));

export const isEmptyRead = ({ sql }: Params): boolean => {
  const text = sql.replace(/\s+/g, ' ');
  return (
    isImpactRead({ sql: text }) ||
    EMPTY_TABLES.some((table) => text.includes(`FROM ${table} `) || text.endsWith(`FROM ${table}`))
  );
};
