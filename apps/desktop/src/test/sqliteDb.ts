import type { Database, Statement } from '@goodboy/db';

export type DbFault = {
  readonly match: RegExp;
  readonly message?: string;
  readonly skip?: number;
};

type ArmedFault = {
  readonly match: RegExp;
  readonly message: string;
  remaining: number;
};

const BROKEN_STATEMENT = 'INSERT INTO story_fault_no_such_table (id) VALUES (1)';

const state: { db: Database | null; faults: ArmedFault[] } = { db: null, faults: [] };

export const openStorySqlite = async (): Promise<Database> => {
  const { makeMigratedTestDatabase } = await import('@goodboy/db/test-helpers');
  state.faults = [];
  state.db = await makeMigratedTestDatabase();
  return state.db;
};

export const storySqlite = (): Database => {
  if (state.db === null) {
    throw new Error('storySqlite: call openStorySqlite() in beforeEach first');
  }
  return state.db;
};

export const injectDbFault = ({
  match,
  message = 'injected db fault',
  skip = 0,
}: DbFault): void => {
  state.faults.push({ match, message, remaining: skip });
};

export const armedDbFaults = (): number => state.faults.length;

const takeFault = (sql: string): ArmedFault | undefined => {
  const index = state.faults.findIndex((fault) => fault.match.test(sql));
  const fault = state.faults[index];
  if (fault === undefined) {
    return undefined;
  }
  if (fault.remaining > 0) {
    fault.remaining -= 1;
    return undefined;
  }
  state.faults.splice(index, 1);
  return fault;
};

const failOn = (sql: string): void => {
  const fault = takeFault(sql);
  if (fault !== undefined) {
    throw new Error(fault.message);
  }
};

const breakMatchingStatement = (statements: ReadonlyArray<Statement>): ReadonlyArray<Statement> => {
  const broken = statements.findIndex((statement) => {
    const fault = takeFault(statement.sql);
    return fault !== undefined;
  });
  if (broken === -1) {
    return statements;
  }
  return statements.map((statement, index) =>
    index === broken ? { sql: BROKEN_STATEMENT, params: [] } : statement,
  );
};

export const faultingSqliteDatabase: Database = {
  async exec(sql) {
    failOn(sql);
    await storySqlite().exec(sql);
  },
  async execute(sql, params) {
    failOn(sql);
    return storySqlite().execute(sql, params);
  },
  async select<T>(sql: string, params?: ReadonlyArray<unknown>) {
    failOn(sql);
    return storySqlite().select<T>(sql, params);
  },
  async transaction({ statements }) {
    return storySqlite().transaction({ statements: breakMatchingStatement(statements) });
  },
};

export const sqliteDbLibModuleMock = () => ({ tauriDatabase: faultingSqliteDatabase });

export const rowsOf = async <T extends Readonly<Record<string, unknown>>>({
  sql,
  params = [],
}: {
  readonly sql: string;
  readonly params?: ReadonlyArray<unknown>;
}): Promise<ReadonlyArray<T>> => storySqlite().select<T>(sql, params);
