import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m205 project identity', () => {
  it('adds local repository identity fields without changing existing projects', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 190 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'ledger-core', '/old/ledger-core', 'repo', 1, 1)",
    );

    await migrate(db, migrations);

    expect(
      await db.select(
        "SELECT root_commit, remote_url, identity_checked_at FROM projects WHERE id = 'project'",
      ),
    ).toEqual([{ root_commit: null, remote_url: null, identity_checked_at: null }]);
  });
});
