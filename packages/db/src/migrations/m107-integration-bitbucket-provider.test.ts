import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough106 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 106),
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

describe('m107 integration bitbucket provider', () => {
  it('accepts a bitbucket row in all three widened tables', async () => {
    const db = await seedThrough106();

    await migrate(db, migrations);

    const now = Date.now();
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES ('ic-bb', 'bitbucket', 'Grace Hopper', 'bitbucket.org/goodboy', ?, ?)`,
      [now, now],
    );
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
       VALUES ('wi-bb', ?, 'bitbucket', '{}', 'ic-bb', ?, ?)`,
      [workspaceId, now, now],
    );
    await db.execute(
      `INSERT INTO session_external_tasks
         (session_id, mount_workspace_id, provider, external_id, identifier, url, title, created_at, branch)
       VALUES (?, NULL, 'bitbucket', '42', 'goodboy/desktop#42', 'https://bitbucket.org/goodboy/desktop/pull-requests/42', 'Ship it', ?, NULL)`,
      [sessionId, now],
    );
    await db.execute(
      `INSERT INTO pr_review_drafts
         (id, session_id, provider, repo, pr_number, path, line, side, body, created_at)
       VALUES ('d-1', ?, 'bitbucket', 'goodboy/desktop', 42, 'src/lib.rs', 12, 'new', 'rename this', ?)`,
      [sessionId, new Date(now).toISOString()],
    );

    const drafts = await db.select<{ provider: string }>('SELECT provider FROM pr_review_drafts');
    expect(drafts).toEqual([{ provider: 'bitbucket' }]);
  });

  it('carries every pr review draft column through the rebuild', async () => {
    const db = await seedThrough106();
    const createdAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO pr_review_drafts
         (id, session_id, provider, repo, pr_number, path, line, start_line, side, body, status, origin, created_at)
       VALUES ('d-0', ?, 'gitlab', 'goodboy/desktop', 7, 'src/app.ts', 30, 24, 'old', 'nit', 'published', 'user', ?)`,
      [sessionId, createdAt],
    );

    await migrate(db, migrations);

    const rows = await db.select<Record<string, unknown>>('SELECT * FROM pr_review_drafts');
    expect(rows).toEqual([
      {
        id: 'd-0',
        session_id: sessionId,
        provider: 'gitlab',
        repo: 'goodboy/desktop',
        pr_number: 7,
        path: 'src/app.ts',
        line: 30,
        start_line: 24,
        side: 'old',
        body: 'nit',
        status: 'published',
        origin: 'user',
        created_at: createdAt,
      },
    ]);
  });

  it('keeps every rebuilt index after the three table swaps', async () => {
    const db = await seedThrough106();

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN ('workspace_integrations', 'session_external_tasks', 'pr_review_drafts') ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_pr_review_drafts_session',
      'idx_session_external_tasks_identity',
      'idx_session_external_tasks_provider_external',
      'idx_workspace_integrations_credential_id',
      'idx_workspace_integrations_workspace_id',
    ]);
  });

  it('still rejects a provider outside each widened check', async () => {
    const db = await seedThrough106();

    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
         VALUES ('wi-x', ?, 'asana', '{}', 'ic-x', ?, ?)`,
        [workspaceId, Date.now(), Date.now()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
    await expect(
      db.execute(
        `INSERT INTO pr_review_drafts
           (id, session_id, provider, repo, pr_number, path, line, side, body, created_at)
         VALUES ('d-x', ?, 'gitea', 'goodboy/desktop', 1, 'a.ts', 1, 'new', 'x', ?)`,
        [sessionId, new Date().toISOString()],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });
});
