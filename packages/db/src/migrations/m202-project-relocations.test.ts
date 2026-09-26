import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m202 project relocations', () => {
  it('records moves and removes their history with the project', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 201 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'ledger-core', '/new/ledger-core', 'repo', 1, 1)",
    );

    await migrate(db, migrations);
    await db.execute(
      "INSERT INTO project_relocations (id, project_id, from_root, to_root, moved_at, created_at, updated_at) VALUES ('move', 'project', '/old/ledger-core', '/new/ledger-core', 2, 2, 2)",
    );

    expect(
      await db.select('SELECT project_id, from_root, to_root, undone_at FROM project_relocations'),
    ).toEqual([
      {
        project_id: 'project',
        from_root: '/old/ledger-core',
        to_root: '/new/ledger-core',
        undone_at: null,
      },
    ]);
    await db.execute("DELETE FROM projects WHERE id = 'project'");
    expect(await db.select('SELECT id FROM project_relocations')).toEqual([]);
  });
});
