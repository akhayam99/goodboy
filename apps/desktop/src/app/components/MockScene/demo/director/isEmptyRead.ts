const EMPTY_TABLES: ReadonlyArray<string> = ['auto_artifacts', 'workspace_starred_issues'];

const IMPACT_FROM_SESSIONS = /\b(?:FROM|JOIN) sessions s\b/;
const IMPACT_WORKSPACE = /\bs\.workspace_id = \?/;
const IMPACT_AGGREGATE = /\b(?:COUNT|SUM|MAX|COALESCE|CASE)\b/;

type Params = {
  readonly sql: string;
};

const isImpactRead = ({ sql }: Params): boolean =>
  IMPACT_FROM_SESSIONS.test(sql) && IMPACT_WORKSPACE.test(sql) && IMPACT_AGGREGATE.test(sql);

export const isEmptyRead = ({ sql }: Params): boolean => {
  const text = sql.replace(/\s+/g, ' ');
  return (
    isImpactRead({ sql: text }) ||
    EMPTY_TABLES.some((table) => text.includes(`FROM ${table} `) || text.endsWith(`FROM ${table}`))
  );
};
