import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type ColumnRow = {
  readonly name: string;
};

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 165 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES ('workflow', 'workspace', 'Workflow', '', 1, 1, 1)",
  );
  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, role_model_overrides, created_at) VALUES (\'run\', \'session\', \'workflow\', 0, 0, 0, \'immediate\', \'dynamic\', \'{"reviewer":{"providerId":"anthropic","model":"claude-sonnet-4-6","effort":"high"}}\', 1)',
  );
  return db;
};

describe('m166 drop workflow run role models', () => {
  it('removes the retired override column without losing the run', async () => {
    const db = await seed();

    await migrate(db, migrations);

    const columns = await db.select<ColumnRow>('PRAGMA table_info(session_workflows)');
    expect(columns.map((column) => column.name)).not.toContain('role_model_overrides');
    expect(
      await db.select('SELECT workflow_run_id, execution_mode FROM session_workflows'),
    ).toEqual([{ workflow_run_id: 'run', execution_mode: 'dynamic' }]);
  });
});
