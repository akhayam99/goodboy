import { describe, expect, it, vi } from 'vitest';
import { listPrsForBranches } from '../branchPullRequests';
import type { GhRunner } from '../gh';

const node = (overrides: Record<string, unknown>) => ({
  number: 1,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/ledger-core/pull/1',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: 'ak/one',
  reviewDecision: null,
  updatedAt: '2026-11-01T10:00:00Z',
  body: '',
  autoMergeRequest: null,
  headRefOid: 'a41c9e2b7d3f',
  mergedAt: null,
  author: { login: 'kenji-w' },
  reviewRequests: { totalCount: 0 },
  isInMergeQueue: false,
  mergeQueueEntry: null,
  commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
  ...overrides,
});

const runnerOf = (stdout: string, exitCode = 0): GhRunner => ({
  run: vi.fn().mockResolvedValue({ stdout, stderr: '', exitCode }),
});

const payload = (repository: Record<string, unknown>) => JSON.stringify({ data: { repository } });

describe('listPrsForBranches', () => {
  it('asks once for every branch and splits the answer per branch', async () => {
    const runner = runnerOf(
      payload({
        b0: { nodes: [node({ number: 1, headRefName: 'ak/one' })] },
        b1: { nodes: [] },
      }),
    );

    const result = await listPrsForBranches({
      runner,
      repo: 'harborline/ledger-core',
      branches: ['ak/one', 'ak/two'],
    });

    expect(runner.run).toHaveBeenCalledTimes(1);
    const args = vi.mocked(runner.run).mock.calls[0]?.[0] ?? [];
    expect(args.slice(0, 2)).toEqual(['api', 'graphql']);
    expect(args).toEqual(expect.arrayContaining(['b0=ak/one', 'b1=ak/two', 'owner=harborline']));
    expect(args).not.toContain('-F');
    expect(result?.get('ak/one')?.map((pr) => pr.number)).toEqual([1]);
    expect(result?.get('ak/two')).toEqual([]);
  });

  it('carries the author as a login and a picture address, and asks the host for both', async () => {
    const runner = runnerOf(
      payload({
        b0: {
          nodes: [
            node({
              number: 1,
              author: {
                login: 'kenji-w',
                avatarUrl: 'https://avatars.harborline.test/kenji-w.png',
              },
            }),
          ],
        },
      }),
    );

    const result = await listPrsForBranches({
      runner,
      repo: 'harborline/ledger-core',
      branches: ['ak/one'],
    });

    expect(result?.get('ak/one')?.[0]?.author).toEqual({
      login: 'kenji-w',
      avatarUrl: 'https://avatars.harborline.test/kenji-w.png',
    });
    const args = vi.mocked(runner.run).mock.calls[0]?.[0] ?? [];
    expect(args.join(' ')).toContain('author{ login avatarUrl }');
  });

  it('keeps an author without an address as a login and no picture', async () => {
    const runner = runnerOf(payload({ b0: { nodes: [node({ number: 1 })] } }));

    const result = await listPrsForBranches({
      runner,
      repo: 'harborline/ledger-core',
      branches: ['ak/one'],
    });

    expect(result?.get('ak/one')?.[0]?.author).toEqual({ login: 'kenji-w', avatarUrl: null });
  });

  it('puts open requests first and reads checks and the merge queue from the same answer', async () => {
    const runner = runnerOf(
      payload({
        b0: {
          nodes: [
            node({ number: 7, state: 'MERGED', updatedAt: '2026-11-02T10:00:00Z' }),
            node({
              number: 8,
              mergeQueueEntry: { position: 2, state: 'QUEUED' },
              commits: {
                nodes: [
                  {
                    commit: {
                      statusCheckRollup: {
                        contexts: {
                          nodes: [
                            { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            }),
          ],
        },
      }),
    );

    const result = await listPrsForBranches({
      runner,
      repo: 'harborline/ledger-core',
      branches: ['ak/one'],
    });

    const [first, second] = result?.get('ak/one') ?? [];
    expect(first?.number).toBe(8);
    expect(first?.state).toBe('queued');
    expect(first?.mergeQueue).toEqual({ position: 2 });
    expect(first?.checks).toBe('failure');
    expect(second?.state).toBe('merged');
  });

  it('splits more than twenty branches into several calls', async () => {
    const runner = runnerOf(payload({}));
    const branches = Array.from({ length: 21 }, (_, index) => `ak/branch-${index}`);

    await listPrsForBranches({ runner, repo: 'harborline/ledger-core', branches });

    expect(runner.run).toHaveBeenCalledTimes(2);
  });

  it('returns null when gh cannot answer so the caller falls back to one call per branch', async () => {
    const runner = runnerOf('', 1);

    const result = await listPrsForBranches({
      runner,
      repo: 'harborline/ledger-core',
      branches: ['ak/one'],
    });

    expect(result).toBeNull();
  });

  it('returns null without asking for a malformed slug or no branches', async () => {
    const runner = runnerOf(payload({}));

    expect(await listPrsForBranches({ runner, repo: 'ledger-core', branches: ['a'] })).toBeNull();
    expect(
      await listPrsForBranches({ runner, repo: 'harborline/ledger-core', branches: [] }),
    ).toBeNull();
    expect(runner.run).not.toHaveBeenCalled();
  });
});
