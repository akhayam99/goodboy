import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m173 agent turn span touched mounts', () => {
  it('leaves spans recorded before it without a known set of worktrees', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 171 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO agent_turn_spans (run_id, workspace_id, step_role, provider, model, started_at, ended_at, end_reason) VALUES ('run', 'workspace', 'implementer', 'anthropic', 'claude-sonnet-5', 1, 2, 'succeeded')",
    );

    await migrate(db, migrations);

    expect(await db.select('SELECT run_id, touched_mount_ids FROM agent_turn_spans')).toEqual([
      { run_id: 'run', touched_mount_ids: null },
    ]);
  });
});
