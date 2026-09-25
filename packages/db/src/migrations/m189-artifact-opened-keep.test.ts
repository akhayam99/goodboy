import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 185 });
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
       '{"reportType":"research"}', 'active', 1, 10, 20)`,
  );
  return db;
};

describe('m189 artifact opened and keep', () => {
  it('adds empty opened and keep dates to existing artifacts', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT id, opened_at, kept_at, kept_until, updated_at FROM session_artifacts',
      ),
    ).toEqual([{ id: 'report', opened_at: null, kept_at: null, kept_until: null, updated_at: 20 }]);
  });

  it('reruns cleanly when a crash left some columns behind', async () => {
    const db = await seedBefore();
    await db.execute('ALTER TABLE session_artifacts ADD COLUMN opened_at INTEGER');

    await migrate(db, migrations);

    expect(await db.select('SELECT opened_at, kept_until FROM session_artifacts')).toEqual([
      { opened_at: null, kept_until: null },
    ]);
  });
});
