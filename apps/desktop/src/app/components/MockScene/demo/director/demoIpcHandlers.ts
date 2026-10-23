import { createDemoSettingsTable } from './demoSettingsTable';
import { DEMO_EXIT_NOTICES } from './demoExitNotices';
import { showDemoNotice } from './showDemoNotice';
import { recordDemoMiss } from './recordDemoMiss';
import { isEmptyRead } from './isEmptyRead';

export type DemoIpcArgs = Readonly<Record<string, unknown>> | undefined;

type Handler = (args: DemoIpcArgs) => unknown;

const settings = createDemoSettingsTable();

type SqlArgs = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

const sqlOf = (args: DemoIpcArgs): SqlArgs => {
  const sql = args?.sql;
  const params = args?.params;
  return {
    sql: typeof sql === 'string' ? sql : '',
    params: Array.isArray(params) ? params : [],
  };
};

const statementsOf = (args: DemoIpcArgs): ReadonlyArray<SqlArgs> => {
  const statements = args?.statements;
  if (!Array.isArray(statements)) {
    return [];
  }
  return statements.map((statement: unknown) =>
    typeof statement === 'object' && statement !== null
      ? sqlOf({ sql: Reflect.get(statement, 'sql'), params: Reflect.get(statement, 'params') })
      : { sql: '', params: [] },
  );
};

const executeOf = (statement: SqlArgs) =>
  settings.execute(statement) ?? { rowsAffected: 1, rows: [] };

const exitHandlers = (): ReadonlyArray<readonly [string, Handler]> =>
  [...DEMO_EXIT_NOTICES.entries()].map(([command, message]) => [
    command,
    () => {
      showDemoNotice({ message });
      return null;
    },
  ]);

export const DEMO_IPC_HANDLERS: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  [
    'db_select',
    (args) => {
      const query = sqlOf(args);
      if (isEmptyRead({ sql: query.sql })) {
        return [];
      }
      return (
        settings.select(query) ??
        recordDemoMiss({ entry: `db_select ${query.sql.replace(/\s+/g, ' ').slice(0, 90)}` })
      );
    },
  ],
  ['db_execute', (args) => executeOf(sqlOf(args))],
  ['db_exec', () => null],
  [
    'db_transaction',
    (args) => ({
      status: 'committed',
      results: statementsOf(args).map(executeOf),
    }),
  ],
  ['plugin:event|listen', (args) => args?.handler ?? 0],
  ['plugin:event|unlisten', () => null],
  ['plugin:event|emit', () => null],
  ...exitHandlers(),
]);
