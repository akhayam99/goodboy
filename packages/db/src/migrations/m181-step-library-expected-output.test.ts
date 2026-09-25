import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

describe('m181 step library expected output', () => {
  it('leaves steps saved before it without an expected output or a base step', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('workspace-1', 'Harborline', 'harborline', ?, ?)`,
      [NOW, NOW],
    );
    await db.execute(
      `INSERT INTO step_library (id, workspace_id, role, name, prompt_prefix, created_at, updated_at)
       VALUES ('lib-copy', 'workspace-1', 'tester', 'Dry run replay', '', ?, ?)`,
      [NOW, NOW],
    );

    await migrate(db, migrations);

    expect(
      await db.select(
        "SELECT id, expected_output, base_step_id FROM step_library WHERE id = 'lib-copy'",
      ),
    ).toEqual([{ id: 'lib-copy', expected_output: null, base_step_id: null }]);
  });

  it('keeps what a step expects and what it was based on', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('workspace-1', 'Harborline', 'harborline', ?, ?)`,
      [NOW, NOW],
    );
    await db.execute(
      `INSERT INTO step_library
         (id, workspace_id, role, name, prompt_prefix, expected_output, base_step_id, created_at, updated_at)
       VALUES ('lib-copy', 'workspace-1', 'tester', 'Dry run replay', '', 'A replay log', 'seed_tester', ?, ?)`,
      [NOW, NOW],
    );

    expect(
      await db.select(
        "SELECT expected_output, base_step_id FROM step_library WHERE id = 'lib-copy'",
      ),
    ).toEqual([{ expected_output: 'A replay log', base_step_id: 'seed_tester' }]);
  });
});
