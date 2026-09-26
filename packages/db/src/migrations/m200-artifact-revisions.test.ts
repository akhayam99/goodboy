import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

describe('m200 artifact revisions', () => {
  it('backfills the current revision of every artifact and drops the unused renditions', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 196 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Report', 'completed')",
    );
    await db.execute(
      `INSERT INTO session_artifacts (id, session_id, agent_id, kind, schema_version, title,
         source_format, source_text, metadata_json, status, revision, created_at, updated_at)
       VALUES ('report-1', 'session', 'agent', 'report', 1, 'Rounding drift', 'markdown',
         '## Outcome', '{}', 'active', 3, 10, 20)`,
    );

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT artifact_id, revision, title, author, created_at FROM artifact_revisions',
      ),
    ).toEqual([
      {
        artifact_id: 'report-1',
        revision: 3,
        title: 'Rounding drift',
        author: 'agent',
        created_at: 20,
      },
    ]);
    expect(
      await db.select(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifact_renditions'",
      ),
    ).toEqual([]);
  });
});
