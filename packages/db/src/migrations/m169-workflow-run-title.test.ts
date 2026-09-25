import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m169 workflow run title', () => {
  it('adds an empty title and a cleared user edit flag to existing runs', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 168 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES ('workflow', 'workspace', 'Feature', '', 1, 1, 1)",
    );
    await db.execute(
      "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, created_at) VALUES ('run', 'session', 'workflow', 0, 0, 0, 'immediate', 'static', 1)",
    );

    await migrate(db, migrations);

    expect(
      await db.select('SELECT workflow_run_id, title, title_user_edited FROM session_workflows'),
    ).toEqual([{ workflow_run_id: 'run', title: null, title_user_edited: 0 }]);
  });
});
