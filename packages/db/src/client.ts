export type StatementGuard = 'rows' | 'noRows' | 'noChanges';

export type PlainStatement = {
  readonly sql: string;
  readonly params?: ReadonlyArray<unknown>;
};

export type GuardedStatement = PlainStatement & {
  readonly abortWhen: StatementGuard;
  readonly abortCode: string;
};

export type Statement = PlainStatement | GuardedStatement;

export type StatementResult = {
  readonly rowsAffected: number;
  readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
};

export type CommittedTransaction = {
  readonly status: 'committed';
  readonly results: ReadonlyArray<StatementResult>;
};

export type AbortedTransaction = {
  readonly status: 'aborted';
  readonly abortCode: string;
  readonly index: number;
};

export type TransactionOutcome = CommittedTransaction | AbortedTransaction;

export type TransactionParams = {
  readonly statements: ReadonlyArray<Statement>;
};

export type Database = {
  exec(sql: string): Promise<void>;
  execute(sql: string, params?: ReadonlyArray<unknown>): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<ReadonlyArray<T>>;
  transaction(params: TransactionParams): Promise<TransactionOutcome>;
};

type GuardTripsParams = {
  readonly guard: StatementGuard;
  readonly result: StatementResult;
};

export const guardTrips = ({ guard, result }: GuardTripsParams): boolean => {
  switch (guard) {
    case 'rows':
      return result.rows.length > 0;
    case 'noRows':
      return result.rows.length === 0;
    case 'noChanges':
      return result.rowsAffected === 0;
    default: {
      const unreachable: never = guard;
      return unreachable;
    }
  }
};

export const isGuardedStatement = (statement: Statement): statement is GuardedStatement =>
  'abortWhen' in statement;
