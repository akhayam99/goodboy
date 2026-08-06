import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { fetchMergeQueuePlacements } from '../merge-queue';

const makeRunner = (result: { stdout: string; stderr: string; exitCode: number }): GhRunner => ({
  run: vi.fn().mockResolvedValue(result),
});

const graphqlPayload = (nodes: unknown) =>
  JSON.stringify({ data: { repository: { pullRequests: { nodes } } } });

describe('fetchMergeQueuePlacements', () => {
  it('keeps only the pull requests that are actually in the queue', async () => {
    const runner = makeRunner({
      stdout: graphqlPayload([
        { number: 4, isInMergeQueue: true, mergeQueueEntry: { position: 1, state: 'QUEUED' } },
        { number: 5, isInMergeQueue: false, mergeQueueEntry: null },
      ]),
      stderr: '',
      exitCode: 0,
    });

    const placements = await fetchMergeQueuePlacements({
      runner,
      repo: 'org/repo',
      branch: 'feature',
    });

    expect(placements.get(4)).toEqual({ position: 1 });
    expect(placements.has(5)).toBe(false);
  });

  it('asks for the whole repo when no branch is given', async () => {
    const runner = makeRunner({ stdout: graphqlPayload([]), stderr: '', exitCode: 0 });

    await fetchMergeQueuePlacements({ runner, repo: 'org/repo', branch: null });

    const args = vi.mocked(runner.run).mock.calls[0]?.[0] ?? [];
    expect(args.some((arg) => arg.includes('headRefName'))).toBe(false);
  });

  it('returns no placements when gh cannot answer, instead of failing the PR fetch', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'not authorized', exitCode: 1 });

    const placements = await fetchMergeQueuePlacements({
      runner,
      repo: 'org/repo',
      branch: 'feature',
    });

    expect(placements.size).toBe(0);
  });

  it('returns no placements when the repo slug is malformed', async () => {
    const runner = makeRunner({ stdout: graphqlPayload([]), stderr: '', exitCode: 0 });

    const placements = await fetchMergeQueuePlacements({ runner, repo: 'repo', branch: null });

    expect(placements.size).toBe(0);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('passes graphql variables untyped so an all-digit branch is not coerced to a number', async () => {
    const runner = makeRunner({ stdout: graphqlPayload([]), stderr: '', exitCode: 0 });

    await fetchMergeQueuePlacements({ runner, repo: 'org/repo', branch: '1234' });

    const args = vi.mocked(runner.run).mock.calls[0]?.[0] ?? [];
    expect(args).not.toContain('-F');
    expect(args).toEqual(expect.arrayContaining(['-f', 'branch=1234']));
  });
});
