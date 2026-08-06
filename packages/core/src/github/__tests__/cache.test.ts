import { describe, expect, it, vi } from 'vitest';
import type { GithubPrCacheEntry, PullRequestState } from '@goodboy/types';
import type { GhRunner } from '../gh';
import {
  DEFAULT_PR_CACHE_TTL_MS,
  type GetPrInput,
  type PrCacheDeps,
  type PrCacheStore,
  getPrForBranch,
  invalidatePrCache,
} from '../cache';

const SAMPLE_PR: PullRequestState = {
  number: 1,
  title: 'Test PR',
  url: 'https://github.com/org/repo/pull/1',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feature',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2024-01-01T00:00:00Z',
};

function makeStore(initial: GithubPrCacheEntry | null = null): PrCacheStore & {
  rows: Map<string, GithubPrCacheEntry>;
} {
  const rows = new Map<string, GithubPrCacheEntry>();
  if (initial) {
    rows.set(`${initial.repoSlug}/${initial.branch}`, initial);
  }

  return {
    rows,
    get: vi.fn(async (repoSlug: string, branch: string) => {
      return rows.get(`${repoSlug}/${branch}`) ?? null;
    }),
    upsert: vi.fn(async (entry: GithubPrCacheEntry) => {
      rows.set(`${entry.repoSlug}/${entry.branch}`, entry);
    }),
    invalidate: vi.fn(async (repoSlug: string, branch: string) => {
      rows.delete(`${repoSlug}/${branch}`);
    }),
  };
}

function makeRunner(pr: PullRequestState | null): GhRunner {
  const payload = pr
    ? [
        {
          number: pr.number,
          title: pr.title,
          url: pr.url,
          state: 'OPEN',
          isDraft: pr.isDraft,
          mergeable: 'MERGEABLE',
          baseRefName: pr.baseBranch,
          headRefName: pr.headBranch,
          reviewDecision: null,
          statusCheckRollup: null,
          updatedAt: pr.updatedAt,
          body: pr.body,
        },
      ]
    : [];
  return {
    run: vi.fn().mockResolvedValue({
      stdout: JSON.stringify(payload),
      stderr: '',
      exitCode: 0,
    }),
  };
}

const BASE_INPUT: GetPrInput = {
  repoSlug: 'org/repo',
  branch: 'feature',
};

const NOW = new Date('2024-06-01T12:00:00Z');

describe('getPrForBranch', () => {
  it('returns cached PR without calling runner when cache is fresh', async () => {
    const freshAt = new Date(NOW.getTime() - 1000).toISOString();
    const store = makeStore({
      repoSlug: 'org/repo',
      branch: 'feature',
      pr: SAMPLE_PR,
      fetchedAt: freshAt,
    });
    const runner = makeRunner(SAMPLE_PR);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    const result = await getPrForBranch(deps, BASE_INPUT);
    expect(result).toEqual(SAMPLE_PR);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('calls runner and upserts when cache is stale', async () => {
    const staleAt = new Date(NOW.getTime() - DEFAULT_PR_CACHE_TTL_MS - 1).toISOString();
    const store = makeStore({
      repoSlug: 'org/repo',
      branch: 'feature',
      pr: SAMPLE_PR,
      fetchedAt: staleAt,
    });
    const freshPr = { ...SAMPLE_PR, title: 'Updated PR' };
    const runner = makeRunner(freshPr);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    const result = await getPrForBranch(deps, BASE_INPUT);
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['pr', 'list']),
      expect.anything(),
    );
    expect(store.upsert).toHaveBeenCalledOnce();
    expect(result?.title).toBe('Updated PR');
  });

  it('calls runner when no cache entry exists', async () => {
    const store = makeStore(null);
    const runner = makeRunner(SAMPLE_PR);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    const result = await getPrForBranch(deps, BASE_INPUT);
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['pr', 'list']),
      expect.anything(),
    );
    expect(result).not.toBeNull();
  });

  it('calls runner when force:true even if cache is fresh', async () => {
    const freshAt = new Date(NOW.getTime() - 100).toISOString();
    const store = makeStore({
      repoSlug: 'org/repo',
      branch: 'feature',
      pr: SAMPLE_PR,
      fetchedAt: freshAt,
    });
    const runner = makeRunner(SAMPLE_PR);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    await getPrForBranch(deps, { ...BASE_INPUT, force: true });
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['pr', 'list']),
      expect.anything(),
    );
  });

  it('upserts null and returns null when runner returns no PR', async () => {
    const store = makeStore(null);
    const runner = makeRunner(null);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    const result = await getPrForBranch(deps, BASE_INPUT);
    expect(result).toBeNull();
    expect(store.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ pr: null, repoSlug: 'org/repo', branch: 'feature' }),
    );
  });

  it('cached null is returned without runner call when fresh', async () => {
    const freshAt = new Date(NOW.getTime() - 500).toISOString();
    const store = makeStore({
      repoSlug: 'org/repo',
      branch: 'feature',
      pr: null,
      fetchedAt: freshAt,
    });
    const runner = makeRunner(SAMPLE_PR);
    const deps: PrCacheDeps = { runner, store, now: () => NOW };

    const result = await getPrForBranch(deps, BASE_INPUT);
    expect(result).toBeNull();
    expect(runner.run).not.toHaveBeenCalled();
  });
});

describe('invalidatePrCache', () => {
  it('clears the cached row', async () => {
    const store = makeStore({
      repoSlug: 'org/repo',
      branch: 'feature',
      pr: SAMPLE_PR,
      fetchedAt: NOW.toISOString(),
    });

    await invalidatePrCache({ store }, 'org/repo', 'feature');
    expect(store.invalidate).toHaveBeenCalledWith('org/repo', 'feature');
    expect(store.rows.get('org/repo/feature')).toBeUndefined();
  });
});

describe('DEFAULT_PR_CACHE_TTL_MS', () => {
  it('is 60 seconds', () => {
    expect(DEFAULT_PR_CACHE_TTL_MS).toBe(60_000);
  });
});
