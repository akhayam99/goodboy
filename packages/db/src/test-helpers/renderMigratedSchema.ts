import type { Database } from '../client';

type SchemaRow = {
  readonly type: string;
  readonly name: string;
  readonly sql: string;
};

const TYPE_ORDER = ['table', 'index', 'view', 'trigger'] as const;
const SEARCH_SHADOW_TABLE = /^search_index_(config|content|data|docsize|idx)$/;

type RenderParams = {
  readonly db: Database;
};

export const renderMigratedSchema = async ({ db }: RenderParams): Promise<string> => {
  const rows = await db.select<SchemaRow>(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid`,
  );
  const statements = TYPE_ORDER.flatMap((type) =>
    rows
      .filter((row) => row.type === type && !SEARCH_SHADOW_TABLE.test(row.name))
      .map((row) => `${row.sql};`),
  );
  return `${statements.join('\n\n')}\n`;
};
