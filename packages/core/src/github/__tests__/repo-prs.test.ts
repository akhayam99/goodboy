import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { listOpenPrsForRepo } from '../repo-prs';

function makeRunner(result: { stdout: string; stderr: string; exitCode: number }): GhRunner {
  return { run: vi.fn().mockResolvedValue(result) };
}

function makeJsonRunner(data: unknown): GhRunner {
  return makeRunner({ stdout: JSON.stringify(data), stderr: '', exitCode: 0 });
}

const BASE_RAW = {
  number: 1,
  title: 'PR title',
  url: 'https://github.com/org/repo/pull/1',
  state: 'OPEN' as const,
  isDraft: false,
  mergeable: 'MERGEABLE' as const,
  baseRefName: 'main',
  headRefName: 'feature',
  reviewDecision: null as null,
  statusCheckRollup: null as null,
  updatedAt: '2024-01-01T00:00:00Z',
  body: null as null,
  autoMergeRequest: null as Record<string, unknown> | null,
  author: { login: 'alice' } as { login?: string | null } | null,
  reviewRequests: null as ReadonlyArray<{ login?: string | null }> | null,
};

describe('listOpenPrsForRepo', () => {
  it('maps author login and review request logins', async () => {
    const pr = {
      ...BASE_RAW,
      author: { login: 'alice' },
      reviewRequests: [{ login: 'bob' }, { login: 'carol' }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result[0]?.author).toBe('alice');
    expect(result[0]?.reviewRequestLogins).toEqual(['bob', 'carol']);
    expect(result[0]?.state).toBe('open');
    expect(result[0]?.baseBranch).toBe('main');
  });

  it('derives draft state from isDraft like the branch resolver', async () => {
    const pr = { ...BASE_RAW, isDraft: true };
    const runner = makeJsonRunner([pr]);
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result[0]?.state).toBe('draft');
    expect(result[0]?.isDraft).toBe(true);
  });

  it('sorts results by updatedAt descending', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, updatedAt: '2024-01-01T00:00:00Z' },
      { ...BASE_RAW, number: 2, updatedAt: '2024-06-01T00:00:00Z' },
    ];
    const runner = makeJsonRunner(prs);
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result.map((p) => p.number)).toEqual([2, 1]);
  });

  it('returns empty author for bot or missing author', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, author: null },
      { ...BASE_RAW, number: 2, author: {} },
    ];
    const runner = makeJsonRunner(prs);
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result.map((p) => p.author)).toEqual(['', '']);
  });

  it('drops review requests without a login', async () => {
    const pr = { ...BASE_RAW, reviewRequests: [{ login: 'bob' }, {}, { login: null }] };
    const runner = makeJsonRunner([pr]);
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result[0]?.reviewRequestLogins).toEqual(['bob']);
  });

  it('returns [] when the gh cli fails', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'no auth', exitCode: 1 });
    const result = await listOpenPrsForRepo(runner, 'org/repo');
    expect(result).toEqual([]);
  });

  it('re-throws non-GhCliError errors', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new TypeError('network error')),
    };
    await expect(listOpenPrsForRepo(runner, 'org/repo')).rejects.toBeInstanceOf(TypeError);
  });
});
