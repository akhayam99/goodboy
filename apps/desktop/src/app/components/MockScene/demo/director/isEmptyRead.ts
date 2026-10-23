const EMPTY_TABLES: ReadonlyArray<string> = ['auto_artifacts'];

type Params = {
  readonly sql: string;
};

export const isEmptyRead = ({ sql }: Params): boolean => {
  const text = sql.replace(/\s+/g, ' ');
  return EMPTY_TABLES.some(
    (table) => text.includes(`FROM ${table} `) || text.endsWith(`FROM ${table}`),
  );
};
