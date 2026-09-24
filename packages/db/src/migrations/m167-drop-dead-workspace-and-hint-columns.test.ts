import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type ColumnRow = {
  readonly name: string;
};

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 166 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, sessions_root, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', '/work/harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES ('workflow', 'workspace', 'Workflow', '', 1, 1, 1)",
  );
  await db.execute(
    "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestrator_hints, orchestrator_hint_log, created_at) VALUES ('run', 'session', 'workflow', 0, 0, 0, 'immediate', 'dynamic', 'skip docs', '[]', 1)",
  );
  return db;
};

const columnsOf = async ({
  db,
  table,
}: {
  readonly db: Awaited<ReturnType<typeof seed>>;
  readonly table: string;
}): Promise<ReadonlyArray<string>> =>
  (await db.select<ColumnRow>(`PRAGMA table_info(${table})`)).map((column) => column.name);

describe('m167 drop dead workspace and hint columns', () => {
  it('removes the sessions root and the pre-log hint text without losing rows', async () => {
    const db = await seed();

    await migrate(db, migrations);

    expect(await columnsOf({ db, table: 'workspaces' })).not.toContain('sessions_root');
    expect(await columnsOf({ db, table: 'session_workflows' })).not.toContain('orchestrator_hints');
    expect(await db.select('SELECT id, slug FROM workspaces')).toEqual([
      { id: 'workspace', slug: 'harborline' },
    ]);
    expect(
      await db.select('SELECT workflow_run_id, orchestrator_hint_log FROM session_workflows'),
    ).toEqual([{ workflow_run_id: 'run', orchestrator_hint_log: '[]' }]);
  });
});
