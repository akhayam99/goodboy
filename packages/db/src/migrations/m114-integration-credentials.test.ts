import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const THROUGH = 113;

const throughM130 = migrations.filter((migration) => migration.version <= 130);

const seedThrough113 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= THROUGH),
  );
  const now = Date.now();
  for (const [id, name] of [
    ['ws-1', 'first'],
    ['ws-2', 'second'],
  ]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, `/tmp/${id}`, now, now],
    );
  }
  return db;
};

type SeedIntegrationParams = {
  readonly db: Database;
  readonly id: string;
  readonly workspaceId: string;
  readonly provider: string;
  readonly config: string;
};

const seedIntegration = async ({
  db,
  id,
  workspaceId,
  provider,
  config,
}: SeedIntegrationParams): Promise<void> => {
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, workspaceId, provider, config, `goodboy.workspace.${workspaceId}.${provider}`, now, now],
  );
};

describe('m114 integration credentials', () => {
  it('gives every existing connection a credential it keeps pointing at', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-linear',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{"workspaceUrlKey":"acme","viewerUserId":"u-1","viewerName":"Grace Hopper"}',
    });

    await migrate(db, throughM130);

    const rows = await db.select<{ id: string; credential_id: string; config: string }>(
      'SELECT id, credential_id, config FROM workspace_integrations',
    );
    expect(rows).toEqual([
      {
        id: 'wi-linear',
        credential_id: 'wi-linear',
        config: '{"workspaceUrlKey":"acme","viewerUserId":"u-1","viewerName":"Grace Hopper"}',
      },
    ]);
    const credentials = await db.select<{
      id: string;
      provider: string;
      label: string;
      account: string;
    }>('SELECT id, provider, label, account FROM integration_credentials');
    expect(credentials).toEqual([
      { id: 'wi-linear', provider: 'linear', label: 'Grace Hopper', account: 'linear.app/acme' },
    ]);
  });

  it('names the credential of every provider from what its token resolved to', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-sentry',
      workspaceId: 'ws-1',
      provider: 'sentry',
      config: '{"org":"acme","project":"web","orgName":"Acme Inc"}',
    });
    await seedIntegration({
      db,
      id: 'wi-gitlab',
      workspaceId: 'ws-1',
      provider: 'gitlab',
      config: '{"userName":"grace","userId":"7","host":"https://gitlab.com"}',
    });
    await seedIntegration({
      db,
      id: 'wi-jira',
      workspaceId: 'ws-2',
      provider: 'jira',
      config: '{"siteUrl":"https://acme.atlassian.net","email":"g@acme.io","projectKey":"ENG"}',
    });
    await seedIntegration({
      db,
      id: 'wi-bitbucket',
      workspaceId: 'ws-2',
      provider: 'bitbucket',
      config: '{"workspaceSlug":"acme","email":"g@acme.io","displayName":"Grace Hopper"}',
    });
    await seedIntegration({
      db,
      id: 'wi-slack',
      workspaceId: 'ws-2',
      provider: 'slack',
      config: '{"teamId":"T1","teamName":"Acme","botUserId":"U1","botUserName":"goodboy"}',
    });

    await migrate(db, throughM130);

    const credentials = await db.select<{ id: string; label: string; account: string }>(
      'SELECT id, label, account FROM integration_credentials ORDER BY id',
    );
    expect(credentials).toEqual([
      { id: 'wi-bitbucket', label: 'Grace Hopper', account: 'bitbucket.org/acme' },
      { id: 'wi-gitlab', label: 'grace', account: 'https://gitlab.com' },
      { id: 'wi-jira', label: 'g@acme.io', account: 'https://acme.atlassian.net' },
      { id: 'wi-sentry', label: 'Acme Inc', account: 'acme' },
      { id: 'wi-slack', label: 'goodboy', account: 'Acme' },
    ]);
  });

  it('falls back to the provider name when a config carries no identity', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-bare',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{}',
    });

    await migrate(db, throughM130);

    const credentials = await db.select<{ label: string; account: string }>(
      'SELECT label, account FROM integration_credentials',
    );
    expect(credentials).toEqual([{ label: 'linear', account: '' }]);
  });

  it('applies once and changes nothing when the chain is replayed', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-linear',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{"workspaceUrlKey":"acme","viewerUserId":"u-1","viewerName":"Grace Hopper"}',
    });

    await migrate(db, throughM130);
    const afterFirst = await db.select<{ id: string }>(
      'SELECT id FROM integration_credentials ORDER BY id',
    );

    const replay = await migrate(db, throughM130);

    expect(replay.applied).toEqual([]);
    expect(
      await db.select<{ id: string }>('SELECT id FROM integration_credentials ORDER BY id'),
    ).toEqual(afterFirst);
  });

  it('lets many workspaces reference one credential', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-linear',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{"workspaceUrlKey":"acme","viewerUserId":"u-1","viewerName":"Grace Hopper"}',
    });

    await migrate(db, throughM130);
    const now = Date.now();
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
       VALUES ('wi-second', 'ws-2', 'linear', '{}', 'wi-linear', ?, ?)`,
      [now, now],
    );

    const rows = await db.select<{ workspace_id: string }>(
      "SELECT workspace_id FROM workspace_integrations WHERE credential_id = 'wi-linear' ORDER BY workspace_id",
    );
    expect(rows).toEqual([{ workspace_id: 'ws-1' }, { workspace_id: 'ws-2' }]);
  });

  it('refuses to delete a credential a workspace still references', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-linear',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{"viewerName":"Grace Hopper"}',
    });

    await migrate(db, throughM130);

    await expect(
      db.execute("DELETE FROM integration_credentials WHERE id = 'wi-linear'"),
    ).rejects.toThrow(/FOREIGN KEY constraint/);
  });

  it('releases the credential once the last workspace disconnects', async () => {
    const db = await seedThrough113();
    await seedIntegration({
      db,
      id: 'wi-linear',
      workspaceId: 'ws-1',
      provider: 'linear',
      config: '{"viewerName":"Grace Hopper"}',
    });

    await migrate(db, throughM130);
    await db.execute("DELETE FROM workspace_integrations WHERE credential_id = 'wi-linear'");
    await db.execute("DELETE FROM integration_credentials WHERE id = 'wi-linear'");

    expect(await db.select<{ id: string }>('SELECT id FROM integration_credentials')).toEqual([]);
  });

  it('drops the workspace-scoped keychain key from the row shape', async () => {
    const db = makeTestDatabase();

    await migrate(db, throughM130);

    const columns = await db.select<{ name: string }>(
      "SELECT name FROM pragma_table_info('workspace_integrations')",
    );
    expect(columns.map((column) => column.name)).not.toContain('credential_key');
    expect(columns.map((column) => column.name)).toContain('credential_id');
  });
});
