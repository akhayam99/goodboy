import { describe, expect, it } from 'vitest';
import type { IdeaBacklogId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deleteIdea,
  insertIdea,
  listIdeasForWorkspace,
  listRawIdeas,
  markIdeaSpawned,
  updateIdeaFailed,
  updateIdeaRephrase,
} from './ideas-backlog';

async function seed() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ['w1', 'ws-1', '/tmp/ws1', now, now],
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ['w2', 'ws-2', '/tmp/ws2', now, now],
  );
  return db;
}

const w1 = 'w1' as WorkspaceId;
const w2 = 'w2' as WorkspaceId;

describe('ideas_backlog queries', () => {
  it('insertIdea persists a raw row with default fields', async () => {
    const db = await seed();
    const idea = await insertIdea(db, {
      id: 'i1' as IdeaBacklogId,
      rawText: 'thought of the day',
      workspaceId: w1,
    });
    expect(idea.status).toBe('raw');
    expect(idea.rephrasedTitle).toBeNull();
    expect(idea.retryCount).toBe(0);
    expect(idea.workspaceId).toBe(w1);
  });

  it('updateIdeaRephrase transitions to rephrased status with title + body', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'i1' as IdeaBacklogId, rawText: 'raw', workspaceId: w1 });
    const updated = await updateIdeaRephrase(db, 'i1' as IdeaBacklogId, 'title', 'body', w2);
    expect(updated.status).toBe('rephrased');
    expect(updated.rephrasedTitle).toBe('title');
    expect(updated.rephrasedBody).toBe('body');
    expect(updated.suggestedWorkspaceId).toBe(w2);
  });

  it('updateIdeaFailed sets status=raw before the third try, failed after', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'i1' as IdeaBacklogId, rawText: 'raw', workspaceId: w1 });
    const r1 = await updateIdeaFailed(db, 'i1' as IdeaBacklogId, 1, 'boom');
    expect(r1.status).toBe('raw');
    const r2 = await updateIdeaFailed(db, 'i1' as IdeaBacklogId, 2, 'boom again');
    expect(r2.status).toBe('failed');
    expect(r2.retryCount).toBe(2);
    expect(r2.lastError).toBe('boom again');
  });

  it('listIdeasForWorkspace returns items for the given workspace only and hides spawned', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'a' as IdeaBacklogId, rawText: 'a', workspaceId: w1 });
    await insertIdea(db, { id: 'b' as IdeaBacklogId, rawText: 'b', workspaceId: w2 });
    await insertIdea(db, { id: 'c' as IdeaBacklogId, rawText: 'c', workspaceId: w1 });
    await markIdeaSpawned(db, 'c' as IdeaBacklogId);
    const list = await listIdeasForWorkspace(db, w1);
    expect(list.map((i) => i.id)).toEqual(['a']);
  });

  it('listRawIdeas returns only raw items (used by recovery sweep)', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'a' as IdeaBacklogId, rawText: 'a', workspaceId: w1 });
    await insertIdea(db, { id: 'b' as IdeaBacklogId, rawText: 'b', workspaceId: w1 });
    await updateIdeaRephrase(db, 'b' as IdeaBacklogId, 't', 'body', null);
    const raws = await listRawIdeas(db, w1);
    expect(raws.map((i) => i.id)).toEqual(['a']);
  });

  it('deleteIdea removes the row', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'i1' as IdeaBacklogId, rawText: 'x', workspaceId: w1 });
    await deleteIdea(db, 'i1' as IdeaBacklogId);
    const list = await listIdeasForWorkspace(db, w1);
    expect(list).toHaveLength(0);
  });

  it('workspace delete cascades to its ideas', async () => {
    const db = await seed();
    await insertIdea(db, { id: 'i1' as IdeaBacklogId, rawText: 'x', workspaceId: w1 });
    await db.execute(`DELETE FROM workspaces WHERE id = ?`, [w1]);
    const list = await listIdeasForWorkspace(db, w1);
    expect(list).toHaveLength(0);
  });
});
