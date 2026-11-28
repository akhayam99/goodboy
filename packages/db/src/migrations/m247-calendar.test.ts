import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, insertRow, migrateThrough } from '../test-helpers/migration-rows';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { migrate } from './runner';

type DatabaseParams = {
  readonly db: Database;
};

type RowParams = {
  readonly overrides: Readonly<Record<string, unknown>>;
};

type ColumnRow = {
  readonly name: string;
};

const seedWorkspace = async ({ db }: DatabaseParams): Promise<void> => {
  await insertRow({
    db,
    table: 'workspaces',
    row: { id: 'w1', slug: '/tmp/harborline', name: 'Harborline', created_at: 1, updated_at: 1 },
  });
};

const sourceRow = ({ overrides }: RowParams) => ({
  id: 'src-1',
  kind: 'ics',
  label: 'Northwind team',
  host: 'calendar.northwind.example',
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

const roleRow = ({ overrides }: RowParams) => ({
  id: 'role-1',
  source_id: 'src-1',
  calendar_id: 'cal-1',
  role: 'busy',
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

const reminderRow = ({ overrides }: RowParams) => ({
  id: 'rem-1',
  workspace_id: 'w1',
  text: 'Ping Teo about notify-relay',
  trigger_kind: 'time',
  due_at: 100,
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

type ColumnsParams = DatabaseParams & {
  readonly table: string;
};

const columnsOf = async ({ db, table }: ColumnsParams) =>
  (await db.select<ColumnRow>(`PRAGMA table_info(${table})`)).map((column) => column.name);

describe('m247 calendar', () => {
  it('adds three empty tables on a copy saved at 246 and keeps its workspaces', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 246 });
    await seedWorkspace({ db });

    const result = await migrateThrough({ db, version: 247 });

    expect(result.applied).toEqual([247]);
    expect(await db.select('SELECT name FROM workspaces')).toEqual([{ name: 'Harborline' }]);
    expect(await db.select('SELECT id FROM calendar_sources')).toEqual([]);
    expect(await db.select('SELECT id FROM calendar_roles')).toEqual([]);
    expect(await db.select('SELECT id FROM reminders')).toEqual([]);
    expect(await columnsOf({ db, table: 'calendar_sources' })).toEqual([
      'id',
      'kind',
      'label',
      'host',
      'created_at',
      'updated_at',
    ]);
    expect(await columnsOf({ db, table: 'reminders' })).toEqual([
      'id',
      'workspace_id',
      'text',
      'trigger_kind',
      'due_at',
      'target_kind',
      'target_id',
      'snoozed_until',
      'done_at',
      'created_at',
      'updated_at',
    ]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('holds a link host only for a calendar link and one source for this Mac', async () => {
    const db = await makeMigratedTestDatabase();

    await insertRow({ db, table: 'calendar_sources', row: sourceRow({ overrides: {} }) });
    await expect(
      insertRow({
        db,
        table: 'calendar_sources',
        row: sourceRow({ overrides: { id: 'src-2', host: null } }),
      }),
    ).rejects.toThrow();
    await insertRow({
      db,
      table: 'calendar_sources',
      row: sourceRow({
        overrides: { id: 'mac-1', kind: 'eventkit', label: 'This Mac', host: null },
      }),
    });
    await expect(
      insertRow({
        db,
        table: 'calendar_sources',
        row: sourceRow({
          overrides: { id: 'mac-2', kind: 'eventkit', label: 'This Mac', host: null },
        }),
      }),
    ).rejects.toThrow();
    await expect(
      insertRow({
        db,
        table: 'calendar_sources',
        row: sourceRow({ overrides: { id: 'src-3', kind: 'google' } }),
      }),
    ).rejects.toThrow();
  });

  it('keeps one role per source and calendar from the closed list, and drops them with the source', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await insertRow({ db, table: 'calendar_sources', row: sourceRow({ overrides: {} }) });
    await insertRow({ db, table: 'calendar_roles', row: roleRow({ overrides: {} }) });

    await expect(
      insertRow({ db, table: 'calendar_roles', row: roleRow({ overrides: { id: 'role-2' } }) }),
    ).rejects.toThrow();
    await expect(
      insertRow({
        db,
        table: 'calendar_roles',
        row: roleRow({ overrides: { id: 'role-3', calendar_id: 'cal-2', role: 'private' } }),
      }),
    ).rejects.toThrow();

    await db.execute("DELETE FROM calendar_sources WHERE id = 'src-1'");

    expect(await db.select('SELECT id FROM calendar_roles')).toEqual([]);
  });

  it('ties each trigger to what it waits on', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspace({ db });

    await insertRow({ db, table: 'reminders', row: reminderRow({ overrides: {} }) });
    await expect(
      insertRow({
        db,
        table: 'reminders',
        row: reminderRow({ overrides: { id: 'r2', due_at: null } }),
      }),
    ).rejects.toThrow();
    await expect(
      insertRow({
        db,
        table: 'reminders',
        row: reminderRow({ overrides: { id: 'r3', trigger_kind: 'ci_green' } }),
      }),
    ).rejects.toThrow();
    await insertRow({
      db,
      table: 'reminders',
      row: reminderRow({
        overrides: {
          id: 'r4',
          trigger_kind: 'ci_green',
          due_at: null,
          target_kind: 'pull_request',
          target_id: 'payments-api#42',
        },
      }),
    });
    await expect(
      insertRow({
        db,
        table: 'reminders',
        row: reminderRow({
          overrides: {
            id: 'r5',
            trigger_kind: 'agent_done',
            target_kind: 'event',
            target_id: 'e1',
          },
        }),
      }),
    ).rejects.toThrow();
    await expect(
      insertRow({
        db,
        table: 'reminders',
        row: reminderRow({ overrides: { id: 'r6', target_kind: 'session' } }),
      }),
    ).rejects.toThrow();
    await expect(
      insertRow({
        db,
        table: 'reminders',
        row: reminderRow({ overrides: { id: 'r7', text: '  ' } }),
      }),
    ).rejects.toThrow();

    expect(await db.select('SELECT id FROM reminders ORDER BY id')).toEqual([
      { id: 'r4' },
      { id: 'rem-1' },
    ]);
  });

  it('drops the reminders of a workspace when the workspace goes away', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await seedWorkspace({ db });
    await insertRow({ db, table: 'reminders', row: reminderRow({ overrides: {} }) });

    await db.execute("DELETE FROM workspaces WHERE id = 'w1'");

    expect(await db.select('SELECT id FROM reminders')).toEqual([]);
  });

  it('is refused by an older build, which offers the backup instead', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version < 247);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
  });
});
