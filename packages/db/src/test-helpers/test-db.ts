import Database from 'better-sqlite3';
import {
  guardTrips,
  isGuardedStatement,
  type AbortedTransaction,
  type Database as DatabaseInterface,
  type Statement,
  type StatementResult,
} from '../client';
import { migrations } from '../migrations/index';
import { migrate } from '../migrations/runner';

type RunStatementParams = {
  readonly db: Database.Database;
  readonly statement: Statement;
};

const runStatement = ({ db, statement }: RunStatementParams): StatementResult => {
  const stmt = db.prepare(statement.sql);
  const params = (statement.params ?? []) as ReadonlyArray<never>;
  if (stmt.reader) {
    return {
      rowsAffected: 0,
      rows: stmt.all(...params) as ReadonlyArray<Readonly<Record<string, unknown>>>,
    };
  }
  return { rowsAffected: stmt.run(...params).changes, rows: [] };
};

type AbortSignal = {
  readonly aborted: AbortedTransaction;
};

const isAbortSignal = (value: unknown): value is AbortSignal =>
  typeof value === 'object' && value !== null && 'aborted' in value;

const wrapDatabase = (db: Database.Database): DatabaseInterface => ({
  async exec(sql) {
    db.exec(sql);
  },
  async execute(sql, params = []) {
    const stmt = db.prepare(sql);
    const result = stmt.run(...(params as ReadonlyArray<never>));
    return { rowsAffected: result.changes };
  },
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
  },
  async transaction({ statements }) {
    const run = db.transaction((): ReadonlyArray<StatementResult> => {
      const results: StatementResult[] = [];
      for (const [index, statement] of statements.entries()) {
        const result = runStatement({ db, statement });
        if (isGuardedStatement(statement) && guardTrips({ guard: statement.abortWhen, result })) {
          const signal: AbortSignal = {
            aborted: { status: 'aborted', abortCode: statement.abortCode, index },
          };
          throw signal;
        }
        results.push(result);
      }
      return results;
    });
    try {
      return { status: 'committed', results: run.immediate() };
    } catch (error) {
      if (isAbortSignal(error)) {
        return error.aborted;
      }
      throw error;
    }
  },
});

const openDatabase = (source: string | Buffer): Database.Database => {
  const db = new Database(source);
  db.pragma('foreign_keys = ON');
  return db;
};

export const makeTestDatabase = (filename = ':memory:'): DatabaseInterface =>
  wrapDatabase(openDatabase(filename));

const LATEST_VERSION = Math.max(...migrations.map((migration) => migration.version));

const templateByVersion = new Map<number, Promise<Buffer>>();

const buildTemplate = async ({ throughVersion }: { throughVersion: number }): Promise<Buffer> => {
  const raw = openDatabase(':memory:');
  await migrate(
    wrapDatabase(raw),
    migrations.filter((migration) => migration.version <= throughVersion),
  );
  const buffer = raw.serialize();
  raw.close();
  return buffer;
};

export const makeMigratedTestDatabase = async ({
  throughVersion = LATEST_VERSION,
}: { throughVersion?: number } = {}): Promise<DatabaseInterface> => {
  const cached = templateByVersion.get(throughVersion);
  const template = cached ?? buildTemplate({ throughVersion });
  if (cached == null) {
    templateByVersion.set(throughVersion, template);
  }
  return wrapDatabase(openDatabase(await template));
};
