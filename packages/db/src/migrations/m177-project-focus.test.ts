import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m177 project focus', () => {
  it('leaves every project linked before it unstarred and without a description', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1)",
    );

    await migrate(db, migrations);

    expect(await db.select('SELECT id, starred_at, description FROM projects')).toEqual([
      { id: 'project', starred_at: null, description: null },
    ]);
  });

  it('keeps a star and a description once they are written', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, starred_at, description) VALUES ('project', 'workspace', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1, 5, 'Settles payments')",
    );

    expect(await db.select('SELECT starred_at, description FROM projects')).toEqual([
      { starred_at: 5, description: 'Settles payments' },
    ]);
  });
});
