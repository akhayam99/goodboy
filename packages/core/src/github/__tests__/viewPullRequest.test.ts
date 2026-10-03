import { describe, expect, it } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { viewPullRequest } from '../resolver';

type Call = ReadonlyArray<string>;

const runnerOf = (result: GhResult): { readonly runner: GhRunner; readonly calls: Call[] } => {
  const calls: Call[] = [];
  return {
    calls,
    runner: {
      run: async (args) => {
        calls.push(args);
        return result;
      },
    },
  };
};

const MERGED = {
  number: 412,
  title: 'Reconcile the ledger export',
  url: 'https://github.com/acme/ledger-core/pull/412',
  state: 'MERGED',
  isDraft: false,
  mergeable: 'UNKNOWN',
  baseRefName: 'main',
  headRefName: 'mq/ledger-export',
  reviewDecision: null,
  statusCheckRollup: null,
  updatedAt: '2026-09-30T10:00:00Z',
  body: null,
  autoMergeRequest: null,
  headRefOid: 'abc123',
  mergedAt: '2026-09-30T10:00:00Z',
};

describe('viewPullRequest', () => {
  it('reads one pull request by number in the named repository', async () => {
    const { runner, calls } = runnerOf({ stdout: JSON.stringify(MERGED), stderr: '', exitCode: 0 });

    const pr = await viewPullRequest({ runner, repo: 'acme/ledger-core', number: 412 });

    expect(calls[0]?.slice(0, 5)).toEqual(['pr', 'view', '412', '--repo', 'acme/ledger-core']);
    expect(pr).toMatchObject({ number: 412, state: 'merged', mergedAt: '2026-09-30T10:00:00Z' });
  });

  it('answers null when gh cannot find it', async () => {
    const { runner } = runnerOf({ stdout: '', stderr: 'no pull requests found', exitCode: 1 });

    await expect(
      viewPullRequest({ runner, repo: 'acme/ledger-core', number: 9 }),
    ).resolves.toBeNull();
  });
});
