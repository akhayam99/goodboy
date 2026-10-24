import { createDemoSettingsTable } from './demoSettingsTable';
import { DEMO_EXIT_NOTICES, DEMO_HOST_NOTICE } from './demoExitNotices';
import { showDemoNotice } from './showDemoNotice';
import { recordDemoMiss } from './recordDemoMiss';
import { isEmptyRead } from './isEmptyRead';
import { APP_VERSION } from '../../../../../shared/lib/appVersion';

export type DemoIpcArgs = Readonly<Record<string, unknown>> | undefined;

type Handler = (args: DemoIpcArgs) => unknown;

const settings = createDemoSettingsTable();

type SqlArgs = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

type ArgsParams = {
  readonly args: DemoIpcArgs;
};

type StatementParams = {
  readonly statement: SqlArgs;
};

const sqlOf = ({ args }: ArgsParams): SqlArgs => {
  const sql = args?.sql;
  const params = args?.params;
  return {
    sql: typeof sql === 'string' ? sql : '',
    params: Array.isArray(params) ? params : [],
  };
};

const statementsOf = ({ args }: ArgsParams): ReadonlyArray<SqlArgs> => {
  const statements = args?.statements;
  if (!Array.isArray(statements)) {
    return [];
  }
  return statements.map((statement: unknown) =>
    typeof statement === 'object' && statement !== null
      ? sqlOf({
          args: { sql: Reflect.get(statement, 'sql'), params: Reflect.get(statement, 'params') },
        })
      : { sql: '', params: [] },
  );
};

const executeOf = ({ statement }: StatementParams) =>
  settings.execute(statement) ?? { rowsAffected: 1, rows: [] };

const EMPTY_LISTS: ReadonlyArray<string> = [
  'detect_editors',
  'detect_browsers',
  'explore_list',
  'process_ledger_list',
  'project_scripts_scan',
  'monitor_watched_ports',
  'terminal_list_live',
  'budget_rule_list',
  'budget_alerts_list',
  'step_def_list',
  'worktree_changed_files',
];

const SEARCH_INDEX_BYTES = 2_621_440;
const DEFAULT_BRANCH_STDOUT = 'main\n';
const SHELL_DONE = { stdout: '', stderr: '', exitCode: 0 };
const SHELL_COMMANDS: ReadonlySet<string> = new Set(['git_push', 'git_push_with_lease']);
const GH_WRITES: ReadonlyArray<string> = ['POST', 'PATCH', 'PUT', 'DELETE'];
const GH_WRITE_VERBS: ReadonlyArray<string> = [
  'create',
  'merge',
  'comment',
  'review',
  'close',
  'edit',
];

const exitHandlers = (): ReadonlyArray<readonly [string, Handler]> =>
  [...DEMO_EXIT_NOTICES.entries()].map(([command, message]) => [
    command,
    () => {
      showDemoNotice({ message });
      return SHELL_COMMANDS.has(command) ? SHELL_DONE : null;
    },
  ]);

const argsOf = ({ args }: ArgsParams): ReadonlyArray<string> => {
  const list = args?.args;
  return Array.isArray(list)
    ? list.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

type GhParams = {
  readonly list: ReadonlyArray<string>;
};

const isGhWrite = ({ list }: GhParams): boolean => {
  if (list[0] === 'api') {
    return (
      list.some((entry) => GH_WRITES.includes(entry.toUpperCase())) ||
      list.includes('-f') ||
      list.includes('--field')
    );
  }
  return list.length > 1 && GH_WRITE_VERBS.includes(list[1] ?? '');
};

export const DEMO_IPC_HANDLERS: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  [
    'db_select',
    (args) => {
      const query = sqlOf({ args });
      if (isEmptyRead({ sql: query.sql })) {
        return [];
      }
      if (query.sql.includes('FROM dbstat')) {
        return [{ bytes: SEARCH_INDEX_BYTES }];
      }
      return (
        settings.select(query) ??
        recordDemoMiss({ entry: `db_select ${query.sql.replace(/\s+/g, ' ').slice(0, 90)}` })
      );
    },
  ],
  ['db_execute', (args) => executeOf({ statement: sqlOf({ args }) })],
  ['db_exec', () => null],
  [
    'db_transaction',
    (args) => ({
      status: 'committed',
      results: statementsOf({ args }).map((statement) => executeOf({ statement })),
    }),
  ],
  [
    'check_provider_budget',
    () => ({
      remainingUsd: null,
      pct: 0,
      exceeded: false,
      overThreshold: false,
      spentUsd: 0,
      capUsd: null,
      thresholdPct: null,
      windowStartMs: 0,
      windowEndMs: 0,
    }),
  ],
  ['session_budget_get', () => null],
  ...EMPTY_LISTS.map((command): readonly [string, Handler] => [command, () => []]),
  ['gh_status', () => ({ available: true, mode: 'gh-cli', scopes: [] })],
  ['app_platform', () => ({ os: 'macos', osVersion: null, arch: 'aarch64', buildSha: null })],
  ['plugin:app|version', () => APP_VERSION],
  ['scratch_dir_prepare', () => '/mock/scratch'],
  ['plugin:path|resolve_directory', () => '/mock/home'],
  [
    'monitor_snapshot',
    () => ({ listeners: [], processes: [], takenAt: Date.now(), isPlatformSupported: true }),
  ],
  ['plugin:event|listen', (args) => args?.handler ?? 0],
  ['plugin:event|unlisten', () => null],
  ['plugin:event|emit', () => null],
  [
    'gh_run',
    (args) => {
      const list = argsOf({ args });
      if (list[0] === 'repo' && list[1] === 'view') {
        return { stdout: DEFAULT_BRANCH_STDOUT, stderr: '', exitCode: 0 };
      }
      if ((list[0] === 'issue' || list[0] === 'pr') && list[1] === 'list') {
        return { stdout: '[]', stderr: '', exitCode: 0 };
      }
      if (!isGhWrite({ list })) {
        return recordDemoMiss({ entry: `gh_run ${list.slice(0, 3).join(' ')}` });
      }
      showDemoNotice({ message: DEMO_HOST_NOTICE });
      return { stdout: '{}', stderr: '', exitCode: 0 };
    },
  ],
  ...exitHandlers(),
]);
