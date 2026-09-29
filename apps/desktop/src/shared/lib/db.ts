import { invoke } from '@tauri-apps/api/core';
import type { Database, StatementResult, TransactionOutcome } from '@goodboy/db';

const UNMANAGED_STATE_MARKER = 'state not managed';

export const DATABASE_FILE_HINT = '~/.goodboy/data.db';

export const DATABASE_UNAVAILABLE_MESSAGE = `Goodboy could not open its database, so it started with nothing loaded. It cannot run until ${DATABASE_FILE_HINT} is moved aside; a fresh one is created on the next launch.`;

class DatabaseUnavailableError extends Error {
  constructor() {
    super(DATABASE_UNAVAILABLE_MESSAGE);
    this.name = 'DatabaseUnavailableError';
  }
}

const describeRejection = (rejection: unknown): string => {
  if (typeof rejection === 'string') {
    return rejection;
  }

  return rejection instanceof Error ? rejection.message : '';
};

export const invokeDb = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args);
  } catch (rejection) {
    if (describeRejection(rejection).includes(UNMANAGED_STATE_MARKER)) {
      throw new DatabaseUnavailableError();
    }

    throw rejection;
  }
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStatementResult = (value: unknown): value is StatementResult =>
  isRecord(value) &&
  typeof value.rowsAffected === 'number' &&
  Array.isArray(value.rows) &&
  value.rows.every(isRecord);

export const isTransactionOutcome = (value: unknown): value is TransactionOutcome => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status === 'committed') {
    return Array.isArray(value.results) && value.results.every(isStatementResult);
  }
  return (
    value.status === 'aborted' &&
    typeof value.abortCode === 'string' &&
    typeof value.index === 'number'
  );
};

export const tauriDatabase: Database = {
  async exec(sql) {
    await invokeDb('db_exec', { sql });
  },
  async execute(sql, params = []) {
    return invokeDb<{ rowsAffected: number }>('db_execute', {
      sql,
      params: [...params],
    });
  },
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    return invokeDb('db_select', {
      sql,
      params: [...params],
    }) as Promise<ReadonlyArray<T>>;
  },
  async transaction({ statements }) {
    const outcome = await invokeDb<unknown>('db_transaction', {
      statements: statements.map((statement) => ({
        ...statement,
        params: [...(statement.params ?? [])],
      })),
    });
    if (!isTransactionOutcome(outcome)) {
      throw new Error('The database returned an unreadable transaction result.');
    }
    return outcome;
  },
};
