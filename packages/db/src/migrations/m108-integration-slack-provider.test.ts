import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough107 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 107),
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

describe('m108 integration slack provider', () => {
  it('accepts a slack row in both widened tables', async () => {
    const db = await seedThrough107();

    await migrate(db, migrations);

    const now = Date.now();
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_key, created_at, updated_at)
       VALUES ('wi-sl', ?, 'slack', '{}', 'goodboy.workspace.ws-1.slack', ?, ?)`,
      [workspaceId, now, now],
    );
    await db.execute(
      `INSERT INTO session_external_tasks
         (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
       VALUES (?, NULL, 'slack', 'C0EN:1723456789.123456', '#eng-alerts › billing webhook fails', 'https://acme.slack.com/archives/C0EN/p1723456789123456', 'billing webhook fails', ?, NULL)`,
      [sessionId, now],
    );

    const rows = await db.select<{ provider: string; external_id: string }>(
      'SELECT provider, external_id FROM session_external_tasks',
    );
    expect(rows).toEqual([{ provider: 'slack', external_id: 'C0EN:1723456789.123456' }]);
  });

  it('carries the bitbucket rows written before the rebuild', async () => {
    const db = await seedThrough107();
    const now = Date.now();
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_key, created_at, updated_at)
       VALUES ('wi-bb', ?, 'bitbucket', '{"workspaceSlug":"goodboy"}', 'k', ?, ?)`,
      [workspaceId, now, now],
    );

    await migrate(db, migrations);

    const rows = await db.select<{ id: string; provider: string; config: string }>(
      'SELECT id, provider, config FROM workspace_integrations',
    );
    expect(rows).toEqual([
      { id: 'wi-bb', provider: 'bitbucket', config: '{"workspaceSlug":"goodboy"}' },
    ]);
  });

  it('leaves the pr review draft check alone because slack is not a review host', async () => {
    const db = await seedThrough107();

    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO pr_review_drafts
           (id, session_id, provider, repo, pr_number, path, line, side, body, created_at)
         VALUES ('d-sl', ?, 'slack', 'goodboy/desktop', 1, 'a.ts', 1, 'new', 'x', ?)`,
        [sessionId, new Date().toISOString()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('still rejects a provider outside each widened check', async () => {
    const db = await seedThrough107();

    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_key, created_at, updated_at)
         VALUES ('wi-x', ?, 'asana', '{}', 'k', ?, ?)`,
        [workspaceId, Date.now(), Date.now()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
    await expect(
      db.execute(
        `INSERT INTO session_external_tasks
           (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
         VALUES (?, NULL, 'asana', '1', 'ASA-1', 'https://app.asana.com/1', 'x', ?, NULL)`,
        [sessionId, Date.now()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('keeps every rebuilt index after the two table swaps', async () => {
    const db = await seedThrough107();

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN ('workspace_integrations', 'session_external_tasks') ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_session_external_tasks_identity',
      'idx_session_external_tasks_provider_external',
      'idx_workspace_integrations_workspace_id',
    ]);
  });
});
