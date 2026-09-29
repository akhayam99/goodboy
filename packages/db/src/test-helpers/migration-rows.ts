import type { Database } from '../client';
import { migrations } from '../migrations/index';
import { migrate } from '../migrations/runner';

export type Row = Readonly<Record<string, unknown>>;

type InsertRowParams = {
  readonly db: Database;
  readonly table: string;
  readonly row: Row;
};

export const insertRow = async ({ db, table, row }: InsertRowParams): Promise<void> => {
  const columns = Object.keys(row);
  const marks = columns.map(() => '?').join(', ');
  await db.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks})`,
    Object.values(row),
  );
};

type SelectRowsParams = {
  readonly db: Database;
  readonly table: string;
  readonly orderBy: string;
};

export const selectRows = ({ db, table, orderBy }: SelectRowsParams): Promise<ReadonlyArray<Row>> =>
  db.select<Row>(`SELECT * FROM ${table} ORDER BY ${orderBy}`);

type MigrateThroughParams = {
  readonly db: Database;
  readonly version: number;
};

export const migrateThrough = ({ db, version }: MigrateThroughParams) =>
  migrate(
    db,
    migrations.filter((migration) => migration.version <= version),
  );

export const foreignKeyViolations = (db: Database): Promise<ReadonlyArray<Row>> =>
  db.select<Row>('PRAGMA foreign_key_check');
