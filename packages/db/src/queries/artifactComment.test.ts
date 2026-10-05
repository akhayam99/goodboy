import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertArtifact, removeArtifact } from './artifact';
import {
  deleteArtifactComment,
  insertArtifactComment,
  listArtifactComments,
  setArtifactCommentsStatus,
  updateArtifactCommentBody,
} from './artifactComment';

const sessionId = 'session' as SessionId;
const artifactId = 'plan-1' as ArtifactId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Ledger export', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Planner', 'completed')",
  );
  await insertArtifact({
    db,
    input: {
      id: artifactId,
      sessionId,
      agentId: 'agent' as AgentId,
      kind: 'plan',
      schemaVersion: 1,
      title: 'Ledger export',
      sourceFormat: 'markdown',
      sourceText: '# Ledger export',
      metadata: {},
    },
  });
  return db;
};

describe('artifact comments', () => {
  it('round-trips each anchor kind in creation order', async () => {
    const db = await seed();
    await insertArtifactComment({
      db,
      id: 'c1',
      sessionId,
      artifactId,
      revision: 1,
      anchor: { kind: 'part', index: 2, title: 'Backfill the ledger' },
      body: 'Split this one',
      createdAt: 10,
    });
    await insertArtifactComment({
      db,
      id: 'c2',
      sessionId,
      artifactId,
      revision: 1,
      anchor: { kind: 'quote', order: 0, text: 'two retries', blockText: 'Retry twice.' },
      body: 'Why two?',
      createdAt: 20,
    });
    await insertArtifactComment({
      db,
      id: 'c3',
      sessionId,
      artifactId,
      revision: 1,
      anchor: { kind: 'block', order: 1, text: 'Rollout' },
      body: 'Add a flag',
      createdAt: 30,
    });
    const comments = await listArtifactComments({ db, artifactId });
    expect(comments.map((comment) => comment.id)).toEqual(['c1', 'c2', 'c3']);
    expect(comments[0]).toMatchObject({
      anchor: { kind: 'part', index: 2, title: 'Backfill the ledger' },
      status: 'draft',
      sentTurnId: null,
      revision: 1,
    });
    expect(comments[1]?.anchor).toEqual({
      kind: 'quote',
      order: 0,
      text: 'two retries',
      blockText: 'Retry twice.',
    });
  });

  it('edits the body, moves statuses and stores the sent turn', async () => {
    const db = await seed();
    await insertArtifactComment({
      db,
      id: 'c1',
      sessionId,
      artifactId,
      revision: 1,
      anchor: { kind: 'block', order: 0, text: 'Goal' },
      body: 'Draft',
    });
    await expect(updateArtifactCommentBody({ db, id: 'c1', body: 'Edited' })).resolves.toBe(true);
    await expect(updateArtifactCommentBody({ db, id: 'missing', body: 'x' })).resolves.toBe(false);
    await setArtifactCommentsStatus({ db, ids: ['c1'], status: 'sent', sentTurnId: 'run-9' });
    expect((await listArtifactComments({ db, artifactId }))[0]).toMatchObject({
      body: 'Edited',
      status: 'sent',
      sentTurnId: 'run-9',
    });
    await setArtifactCommentsStatus({ db, ids: ['c1'], status: 'open' });
    expect((await listArtifactComments({ db, artifactId }))[0]).toMatchObject({
      status: 'open',
      sentTurnId: 'run-9',
    });
  });

  it('deletes one comment and cascades with the artifact', async () => {
    const db = await seed();
    for (const id of ['c1', 'c2']) {
      await insertArtifactComment({
        db,
        id,
        sessionId,
        artifactId,
        revision: 1,
        anchor: { kind: 'block', order: 0, text: 'Goal' },
        body: id,
      });
    }
    await expect(deleteArtifactComment({ db, id: 'c1' })).resolves.toBe(true);
    expect(await listArtifactComments({ db, artifactId })).toHaveLength(1);
    await removeArtifact({ db, artifactId });
    expect(await listArtifactComments({ db, artifactId })).toEqual([]);
  });

  it('rejects an unknown status at the table', async () => {
    const db = await seed();
    await expect(
      db.execute(
        `INSERT INTO artifact_comments (id, session_id, artifact_id, revision, anchor_json, body, status, created_at, updated_at)
         VALUES ('bad', 'session', 'plan-1', 1, '{}', 'x', 'resolved', 1, 1)`,
      ),
    ).rejects.toThrow();
  });
});
