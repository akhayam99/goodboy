import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getArtifact, insertArtifact, updateArtifactSource } from './artifact';
import {
  listArtifactRevisions,
  loadArtifactRevision,
  restoreArtifactRevision,
} from './artifactRevisions';

const sessionId = 'session' as SessionId;
const agentId = 'agent' as AgentId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Planner', 'completed')",
  );
  return db;
};

const insertReport = async (db: Database, id: string) =>
  insertArtifact({
    db,
    input: {
      id: id as ArtifactId,
      sessionId,
      agentId,
      kind: 'report',
      schemaVersion: 1,
      title: 'Session report',
      sourceFormat: 'markdown',
      sourceText: '## Outcome',
      metadata: { reportType: 'session-summary' },
    },
  });

describe('artifactRevisions queries', () => {
  it('lists every revision newest first, starting from the one insertArtifact wrote', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    await updateArtifactSource({
      db,
      input: {
        id: 'report-1' as ArtifactId,
        title: 'Session report v2',
        sourceFormat: 'markdown',
        sourceText: '## Outcome v2',
        metadata: { reportType: 'session-summary' },
        author: 'user',
      },
    });

    const revisions = await listArtifactRevisions({ db, artifactId: 'report-1' as ArtifactId });

    expect(revisions.map((entry) => entry.revision)).toEqual([2, 1]);
    expect(revisions[0]).toMatchObject({
      revision: 2,
      title: 'Session report v2',
      sourceText: '## Outcome v2',
      author: 'user',
    });
    expect(revisions[1]).toMatchObject({
      revision: 1,
      title: 'Session report',
      sourceText: '## Outcome',
      author: 'agent',
    });
  });

  it('loads one revision by number, or nothing if it never existed', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');

    const found = await loadArtifactRevision({
      db,
      artifactId: 'report-1' as ArtifactId,
      revision: 1,
    });
    expect(found?.title).toBe('Session report');

    const missing = await loadArtifactRevision({
      db,
      artifactId: 'report-1' as ArtifactId,
      revision: 9,
    });
    expect(missing).toBeNull();
  });

  it('restores an old revision as a new one, never rewriting history', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    await updateArtifactSource({
      db,
      input: {
        id: 'report-1' as ArtifactId,
        title: 'Session report v2',
        sourceFormat: 'markdown',
        sourceText: '## Outcome v2',
        metadata: { reportType: 'session-summary' },
        author: 'user',
      },
    });

    const restored = await restoreArtifactRevision({
      db,
      artifactId: 'report-1' as ArtifactId,
      revision: 1,
    });

    expect(restored.revision).toBe(3);
    expect(restored.sourceText).toBe('## Outcome');
    const current = await getArtifact({ db, artifactId: 'report-1' as ArtifactId });
    expect(current?.sourceText).toBe('## Outcome');
    const revisions = await listArtifactRevisions({ db, artifactId: 'report-1' as ArtifactId });
    expect(revisions.map((entry) => entry.revision)).toEqual([3, 2, 1]);
    expect(revisions[0]).toMatchObject({
      revision: 3,
      author: 'restore',
      sourceText: '## Outcome',
    });
  });

  it('refuses to restore a revision that does not exist', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');

    await expect(
      restoreArtifactRevision({ db, artifactId: 'report-1' as ArtifactId, revision: 5 }),
    ).rejects.toThrow();
  });
});
