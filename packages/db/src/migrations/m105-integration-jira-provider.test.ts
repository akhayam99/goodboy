import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough104 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 104),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

describe('m105 integration jira provider', () => {
  it('carries mount_workspace_id and branch through the external task rebuild', async () => {
    const db = await seedThrough104();
    await db.execute(
      `INSERT INTO session_external_tasks
         (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
       VALUES (?, ?, 'linear', 'ext-1', 'GB-1', 'https://linear.app/goodboy/issue/GB-1', 'Ship it', ?, 'ak/fix-auth')`,
      [sessionId, workspaceId, Date.now()],
    );

    await migrate(db, migrations);

    const rows = await db.select<{ mount_workspace_id: string | null; branch: string | null }>(
      'SELECT mount_workspace_id, branch FROM session_external_tasks',
    );
    expect(rows).toEqual([{ mount_workspace_id: workspaceId, branch: 'ak/fix-auth' }]);
  });

  it('keeps both external task indexes after the rebuild', async () => {
    const db = await seedThrough104();

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_external_tasks' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_session_external_tasks_identity',
      'idx_session_external_tasks_provider_external',
    ]);
  });

  it('accepts a jira row in both widened tables', async () => {
    const db = await seedThrough104();

    await migrate(db, migrations);

    const now = Date.now();
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES ('ic-jira', 'jira', 'Grace Hopper', 'https://acme.atlassian.net', ?, ?)`,
      [now, now],
    );
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
       VALUES ('wi-jira', ?, 'jira', '{}', 'ic-jira', ?, ?)`,
      [workspaceId, now, now],
    );
    await db.execute(
      `INSERT INTO session_external_tasks
         (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
       VALUES (?, NULL, 'jira', '10001', 'GB-7', 'https://acme.atlassian.net/browse/GB-7', 'Ship it', ?, NULL)`,
      [sessionId, now],
    );

    const providers = await db.select<{ provider: string }>(
      'SELECT provider FROM session_external_tasks',
    );
    expect(providers).toEqual([{ provider: 'jira' }]);
  });

  it('still rejects a provider outside the widened check', async () => {
    const db = await seedThrough104();

    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
         VALUES ('wi-x', ?, 'asana', '{}', 'ic-x', ?, ?)`,
        [workspaceId, Date.now(), Date.now()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });
});
