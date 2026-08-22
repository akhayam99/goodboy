import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import { migrate } from '../migrations/runner';
import {
  insertSessionWorktree,
  listWorktreesForSession,
  updateSessionWorktreeRepoSlug,
} from './session-worktree';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;
const otherSessionId = 's2' as SessionId;

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, migrations);
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  for (const id of [sessionId, otherSessionId]) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workspaceId, 'goal', 'idle', now, now],
    );
  }
  return db;
};

describe('updateSessionWorktreeRepoSlug', () => {
  it('stamps only the addressed mount of a composite session', async () => {
    const db = await seed();
    await insertSessionWorktree(db, {
      id: 'wt-api',
      sessionId,
      worktreePath: '/tmp/wt/api',
      branch: 'ak/shared',
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    await insertSessionWorktree(db, {
      id: 'wt-web',
      sessionId,
      worktreePath: '/tmp/wt/web',
      branch: 'ak/shared',
      parallelIndex: 1,
      createdAt: Date.now(),
    });

    await updateSessionWorktreeRepoSlug({
      db,
      sessionId,
      worktreePath: '/tmp/wt/api',
      repoSlug: 'acme/api',
    });

    const rows = await listWorktreesForSession(db, sessionId);
    expect(rows.find((row) => row.id === 'wt-api')?.repoSlug).toBe('acme/api');
    expect(rows.find((row) => row.id === 'wt-web')?.repoSlug).toBeUndefined();
  });

  it('stamps nothing when the addressed path belongs to another session', async () => {
    const db = await seed();
    await insertSessionWorktree(db, {
      id: 'wt-mine',
      sessionId,
      worktreePath: '/tmp/wt/mine',
      branch: 'ak/mine',
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    await insertSessionWorktree(db, {
      id: 'wt-theirs',
      sessionId: otherSessionId,
      worktreePath: '/tmp/wt/theirs',
      branch: 'ak/theirs',
      parallelIndex: 0,
      createdAt: Date.now(),
    });

    await updateSessionWorktreeRepoSlug({
      db,
      sessionId,
      worktreePath: '/tmp/wt/theirs',
      repoSlug: 'acme/theirs',
    });

    const theirs = await listWorktreesForSession(db, otherSessionId);
    const mine = await listWorktreesForSession(db, sessionId);
    expect(theirs[0]?.repoSlug).toBeUndefined();
    expect(mine[0]?.repoSlug).toBeUndefined();
  });
});

describe('insertSessionWorktree', () => {
  it('round-trips a repo slug and leaves an unstamped mount undefined', async () => {
    const db = await seed();
    await insertSessionWorktree(db, {
      id: 'wt-stamped',
      sessionId,
      worktreePath: '/tmp/wt/stamped',
      branch: 'ak/stamped',
      parallelIndex: 0,
      repoSlug: 'acme/stamped',
      createdAt: Date.now(),
    });
    await insertSessionWorktree(db, {
      id: 'wt-bare',
      sessionId,
      worktreePath: '/tmp/wt/bare',
      branch: 'ak/bare',
      parallelIndex: 1,
      createdAt: Date.now(),
    });

    const rows = await listWorktreesForSession(db, sessionId);
    expect(rows.find((row) => row.id === 'wt-stamped')?.repoSlug).toBe('acme/stamped');
    expect(rows.find((row) => row.id === 'wt-bare')?.repoSlug).toBeUndefined();
  });
});
