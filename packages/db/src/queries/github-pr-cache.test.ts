import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { insertSessionWorktree } from './session-worktree';
import {
  deleteGithubPrCacheForWorktreePath,
  getGithubPrCache,
  upsertGithubPrCache,
} from './github-pr-cache';

const NOW = Date.UTC(2026, 7, 22, 12, 0, 0);
const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'workspace', '/tmp/workspace', NOW, NOW],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', NOW, NOW],
  );
  return db;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('GitHub PR cache', () => {
  it('treats entries older than ten minutes and invalid timestamps as stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const db = await seed();
    await upsertGithubPrCache(db, {
      branch: 'ak/stale',
      repoSlug: 'acme/repo',
      pr: null,
      fetchedAt: new Date(NOW - 10 * 60 * 1000 - 1).toISOString(),
    });
    await upsertGithubPrCache(db, {
      branch: 'ak/invalid',
      repoSlug: 'acme/repo',
      pr: null,
      fetchedAt: 'not-a-date',
    });
    await upsertGithubPrCache(db, {
      branch: 'ak/fresh',
      repoSlug: 'acme/repo',
      pr: null,
      fetchedAt: new Date(NOW - 9 * 60 * 1000).toISOString(),
    });

    await expect(getGithubPrCache(db, 'acme/repo', 'ak/stale')).resolves.toBeNull();
    await expect(getGithubPrCache(db, 'acme/repo', 'ak/invalid')).resolves.toBeNull();
    await expect(getGithubPrCache(db, 'acme/repo', 'ak/fresh')).resolves.toMatchObject({
      branch: 'ak/fresh',
    });
  });

  it('deletes only cache rows owned by the removed worktree', async () => {
    const db = await seed();
    await insertSessionWorktree(db, {
      id: 'worktree-1',
      sessionId,
      worktreePath: '/tmp/worktree',
      branch: 'ak/branch',
      parallelIndex: 0,
      repoSlug: 'acme/repo',
      createdAt: NOW,
    });
    await db.execute(
      `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
       VALUES
         ('ak/branch', 'acme/repo', NULL, ?),
         ('ak/branch', 'other/repo', NULL, ?),
         ('ak/other', 'acme/repo', NULL, ?)`,
      [new Date(NOW).toISOString(), new Date(NOW).toISOString(), new Date(NOW).toISOString()],
    );

    await expect(
      deleteGithubPrCacheForWorktreePath({ db, worktreePath: '/tmp/worktree' }),
    ).resolves.toBe(1);
    const rows = await db.select<{ branch: string; repo_slug: string }>(
      'SELECT branch, repo_slug FROM github_pr_cache ORDER BY repo_slug, branch',
    );
    expect(rows).toEqual([
      { branch: 'ak/other', repo_slug: 'acme/repo' },
      { branch: 'ak/branch', repo_slug: 'other/repo' },
    ]);
  });

  it('does not use a worktree with an unknown repo as a branch wildcard', async () => {
    const db = await seed();
    await insertSessionWorktree(db, {
      id: 'worktree-1',
      sessionId,
      worktreePath: '/tmp/worktree',
      branch: 'ak/branch',
      parallelIndex: 0,
      createdAt: NOW,
    });
    await db.execute(
      `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
       VALUES
         ('ak/branch', 'acme/repo', NULL, ?),
         ('ak/branch', 'other/repo', NULL, ?)`,
      [new Date(NOW).toISOString(), new Date(NOW).toISOString()],
    );

    await expect(
      deleteGithubPrCacheForWorktreePath({ db, worktreePath: '/tmp/worktree' }),
    ).resolves.toBe(0);
    const rows = await db.select<{ repo_slug: string }>(
      'SELECT repo_slug FROM github_pr_cache ORDER BY repo_slug',
    );
    expect(rows).toEqual([{ repo_slug: 'acme/repo' }, { repo_slug: 'other/repo' }]);
  });
});
