import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertArtifact, removeArtifact, updateArtifactSource } from './artifact';
import { listArtifactRevisions, loadArtifactRevision } from './artifactRevision';

const artifactId = 'wireframe-1' as ArtifactId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Wireframe', 'completed')",
  );
  await insertArtifact({
    db,
    input: {
      id: artifactId,
      sessionId: 'session' as SessionId,
      agentId: 'agent' as AgentId,
      kind: 'wireframe',
      schemaVersion: 1,
      title: 'Settlement review flow',
      sourceFormat: 'json',
      sourceText: '{"v":1}',
      metadata: { fidelity: 'low', designProfile: {} },
    },
  });
  return db;
};

describe('artifact revisions', () => {
  it('keeps the first draft and every later source as its own revision', async () => {
    const db = await seed();
    await updateArtifactSource({
      db,
      input: {
        id: artifactId,
        title: 'Settlement review flow',
        sourceFormat: 'json',
        sourceText: '{"v":2}',
        metadata: { fidelity: 'low', designProfile: {} },
        note: {
          author: 'agent',
          ask: 'Show who owns each exception',
          pinned: {
            scope: 'screen',
            screenId: 'review-batch',
            nodes: [{ nodeId: 'exception-list', label: 'Exception list' }],
          },
          summary: { changed: 1, added: 2 },
        },
      },
    });
    const revisions = await listArtifactRevisions({ db, artifactId });
    expect(revisions.map((entry) => [entry.revision, entry.sourceText, entry.author])).toEqual([
      [2, '{"v":2}', 'agent'],
      [1, '{"v":1}', 'agent'],
    ]);
    const latest = await loadArtifactRevision({ db, artifactId, revision: 2 });
    expect(latest?.ask).toBe('Show who owns each exception');
    expect(latest?.pinned?.nodes).toEqual([{ nodeId: 'exception-list', label: 'Exception list' }]);
    expect(latest?.summary).toEqual({ changed: 1, added: 2 });
  });

  it('marks a hand edit as the user and drops the history with the artifact', async () => {
    const db = await seed();
    await updateArtifactSource({
      db,
      input: {
        id: artifactId,
        title: 'Settlement review flow',
        sourceFormat: 'json',
        sourceText: '{"v":3}',
        metadata: { fidelity: 'low', designProfile: {} },
      },
    });
    expect((await loadArtifactRevision({ db, artifactId, revision: 2 }))?.author).toBe('user');
    await removeArtifact({ db, artifactId });
    expect(await listArtifactRevisions({ db, artifactId })).toEqual([]);
  });
});
