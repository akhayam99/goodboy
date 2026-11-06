import { isRecord } from '@goodboy/types/helpers';

type Params = {
  readonly command: unknown;
  readonly args?: unknown;
};

type SqlParams = {
  readonly value: unknown;
};

const QUEUE_TABLE = 'agent_queued_messages';

const NO_STATEMENTS: ReadonlyArray<unknown> = [];

const sqlOf = ({ value }: SqlParams): string =>
  isRecord(value) && typeof value.sql === 'string' ? value.sql : '';

export const queueOnlyInvoke = ({ command, args }: Params): Promise<unknown> => {
  const statements: ReadonlyArray<unknown> =
    isRecord(args) && Array.isArray(args.statements) ? args.statements : NO_STATEMENTS;
  if (
    command === 'db_transaction' &&
    statements.some((value) => sqlOf({ value }).includes(QUEUE_TABLE))
  ) {
    return Promise.resolve({
      status: 'committed',
      results: statements.map(() => ({ rowsAffected: 1, rows: [] })),
    });
  }
  if (command === 'db_select' && sqlOf({ value: args }).includes("'user_text'")) {
    return Promise.resolve([{ count: 0 }]);
  }
  return new Promise<never>(() => undefined);
};
