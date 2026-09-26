import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 196 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Scout', 'completed')",
  );
  await db.execute(
    `INSERT INTO session_artifacts
      (id, session_id, agent_id, kind, schema_version, title, source_format, source_text,
       metadata_json, status, revision, created_at, updated_at)
     VALUES ('report', 'session', 'agent', 'report', 1, 'Settlement batch sizing', 'markdown', '# Hi',
       '{"reportType":"research"}', 'active', 3, 10, 20)`,
  );
  return db;
};

describe('m197 artifact revisions', () => {
  it('backfills one revision row per existing artifact at its current revision', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT artifact_id, revision, title, source_text, author, created_at FROM artifact_revisions',
      ),
    ).toEqual([
      {
        artifact_id: 'report',
        revision: 3,
        title: 'Settlement batch sizing',
        source_text: '# Hi',
        author: 'agent',
        created_at: 20,
      },
    ]);
  });

  it('drops the never-written artifact_renditions table', async () => {
    const db = await seedBefore();
    await db.execute(
      `CREATE TABLE IF NOT EXISTS artifact_renditions (
        artifact_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        format TEXT NOT NULL,
        renderer_version TEXT NOT NULL,
        bytes BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (artifact_id, revision, format, renderer_version)
      )`,
    );

    await migrate(db, migrations);

    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifact_renditions'",
    );
    expect(tables).toEqual([]);
  });

  it('reruns cleanly once the table already exists', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await expect(migrate(db, migrations)).resolves.not.toThrow();
    expect(await db.select('SELECT artifact_id FROM artifact_revisions')).toHaveLength(1);
  });
});
