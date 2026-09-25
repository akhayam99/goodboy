import { describe, expect, it } from 'vitest';
import type { ArtifactId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listOrphanArtifacts,
  markArtifactOpened,
  purgeOrphanArtifact,
  setArtifactKeep,
} from './artifact-orphan';

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, deleted_at)
     VALUES ('live', 'workspace', 'Close the ledger month', 'idle', 1, 1, NULL),
            ('gone', 'workspace', 'Rounding drift', 'idle', 1, 1, 500)`,
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('live-agent', 'live', 0, 'Scout', 'completed'),
            ('gone-agent', 'gone', 0, 'Scout', 'completed'),
            ('gone-planner', 'gone', 1, 'Planner', 'completed')`,
  );
  await db.execute(
    `INSERT INTO session_artifacts
      (id, session_id, agent_id, kind, schema_version, title, source_format, source_text,
       metadata_json, status, revision, source_turn_id, created_at, updated_at)
     VALUES
      ('live-report', 'live', 'live-agent', 'report', 1, 'Close', 'markdown', '#', '{"reportType":"r"}', 'active', 1, 't1', 10, 10),
      ('gone-report', 'gone', 'gone-agent', 'report', 1, 'Rounding drift', 'markdown', '#', '{"reportType":"r"}', 'active', 2, 't2', 20, 30),
      ('gone-plan', 'gone', 'gone-planner', 'plan', 1, 'Fix postings', 'markdown', '#', '{}', 'active', 1, 't3', 40, 40)`,
  );
  await db.execute(
    `INSERT INTO artifact_provenance (agent_id, session_id, kind, evidence_json, omissions_json, created_at)
     VALUES ('gone-agent', 'gone', 'report', '[]', '[]', 1),
            ('live-agent', 'live', 'report', '[]', '[]', 1)`,
  );
  return db;
};

describe('orphan artifact queries', () => {
  it('lists only artifacts of deleted sessions with their workspace', async () => {
    const db = await seed();

    const rows = await listOrphanArtifacts({ db });

    expect(rows.map((row) => [row.id, row.kind, row.deletedAt, row.workspaceSlug])).toEqual([
      ['gone-report', 'report', 500, 'harborline'],
      ['gone-plan', 'plan', 500, 'harborline'],
    ]);
    expect(rows[0]?.createdAt).toBe(new Date(20).toISOString());
    expect(rows[0]?.sessionGoal).toBe('Rounding drift');
  });

  it('records the last opening and the keep dates', async () => {
    const db = await seed();
    const artifactId = 'gone-report' as ArtifactId;

    await markArtifactOpened({ db, artifactId, openedAt: 900 });
    await setArtifactKeep({ db, artifactId, keptAt: 900, keptUntil: 1900 });

    const row = (await listOrphanArtifacts({ db })).find((item) => item.id === artifactId);
    expect([row?.openedAt, row?.keptAt, row?.keptUntil, row?.updatedAt]).toEqual([
      900, 900, 1900, 30,
    ]);
  });

  it('deletes an orphan with its provenance and leaves live artifacts alone', async () => {
    const db = await seed();

    await purgeOrphanArtifact({ db, artifactId: 'gone-report' as ArtifactId });
    await purgeOrphanArtifact({ db, artifactId: 'live-report' as ArtifactId });

    expect(await db.select('SELECT id FROM session_artifacts ORDER BY id')).toEqual([
      { id: 'gone-plan' },
      { id: 'live-report' },
    ]);
    expect(await db.select('SELECT agent_id FROM artifact_provenance')).toEqual([
      { agent_id: 'live-agent' },
    ]);
  });
});
