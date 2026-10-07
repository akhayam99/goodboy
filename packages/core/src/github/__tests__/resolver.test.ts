import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { detectRepoSlug, listPrsForBranch, resolvePrForBranch, viewPullRequest } from '../resolver';

type Call = ReadonlyArray<string>;

function makeRunner(result: { stdout: string; stderr: string; exitCode: number }): GhRunner {
  return { run: vi.fn().mockResolvedValue(result) };
}

function makeJsonRunner(data: unknown): GhRunner {
  return makeRunner({ stdout: JSON.stringify(data), stderr: '', exitCode: 0 });
}

type MergeQueueNode = {
  number: number;
  isInMergeQueue: boolean;
  mergeQueueEntry: { position: number | null; state: string } | null;
};

const makeMergeQueueAwareRunner = ({
  prs,
  mergeQueueNodes,
}: {
  prs: unknown;
  mergeQueueNodes: ReadonlyArray<MergeQueueNode>;
}): GhRunner => ({
  run: vi.fn(async (args: ReadonlyArray<string>) => {
    if (args.includes('graphql')) {
      return {
        stdout: JSON.stringify({
          data: { repository: { pullRequests: { nodes: mergeQueueNodes } } },
        }),
        stderr: '',
        exitCode: 0,
      };
    }
    return { stdout: JSON.stringify(prs), stderr: '', exitCode: 0 };
  }),
});

const BASE_RAW = {
  number: 1,
  title: 'PR title',
  url: 'https://github.com/org/repo/pull/1',
  isDraft: false,
  mergeable: 'MERGEABLE' as const,
  baseRefName: 'main',
  headRefName: 'feature',
  reviewDecision: null as null,
  statusCheckRollup: null as null,
  updatedAt: '2024-01-01T00:00:00Z',
  body: null as null,
  autoMergeRequest: null as Record<string, unknown> | null,
};

describe('resolvePrForBranch', () => {
  it('returns null when runner returns empty array', async () => {
    const runner = makeJsonRunner([]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result).toBeNull();
  });

  it('returns null when GhCliError thrown', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'not found', exitCode: 1 }),
    };
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result).toBeNull();
  });

  it('re-throws non-GhCliError errors', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new TypeError('network error')),
    };
    await expect(resolvePrForBranch(runner, 'org/repo', 'feature')).rejects.toBeInstanceOf(
      TypeError,
    );
  });

  it('returns most recent OPEN PR when multiple exist', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, state: 'OPEN' as const, updatedAt: '2024-01-01T00:00:00Z' },
      { ...BASE_RAW, number: 2, state: 'OPEN' as const, updatedAt: '2024-03-01T00:00:00Z' },
      { ...BASE_RAW, number: 3, state: 'MERGED' as const, updatedAt: '2024-06-01T00:00:00Z' },
    ];
    const runner = makeJsonRunner(prs);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.number).toBe(2);
  });

  it('falls back to most recent overall when no OPEN PRs', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, state: 'CLOSED' as const, updatedAt: '2024-01-01T00:00:00Z' },
      { ...BASE_RAW, number: 2, state: 'MERGED' as const, updatedAt: '2024-06-01T00:00:00Z' },
    ];
    const runner = makeJsonRunner(prs);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.number).toBe(2);
  });

  it('maps MERGED state → merged', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'MERGED' as const };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('merged');
  });

  it('maps CLOSED state → closed', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'CLOSED' as const };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('closed');
  });

  it('maps isDraft:true on OPEN → draft', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, isDraft: true };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('draft');
  });

  it('maps OPEN + reviewDecision APPROVED → approved (not draft)', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: false,
      reviewDecision: 'APPROVED' as const,
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('approved');
  });

  it('does not map APPROVED to approved when draft is true', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: true,
      reviewDecision: 'APPROVED' as const,
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('draft');
  });

  it('does not map APPROVED to approved when MERGED', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'MERGED' as const,
      reviewDecision: 'APPROVED' as const,
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('merged');
  });

  it('maps OPEN + autoMergeRequest object → queued without forging a mergeQueue entry', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      autoMergeRequest: { enabledAt: '2024-01-01T00:00:00Z' },
    };
    const runner = makeMergeQueueAwareRunner({ prs: [pr], mergeQueueNodes: [] });
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('queued');
    expect(result?.mergeQueue).toBeNull();
  });

  it('maps a live merge queue entry → queued with its position', async () => {
    const pr = { ...BASE_RAW, number: 7, state: 'OPEN' as const };
    const runner = makeMergeQueueAwareRunner({
      prs: [pr],
      mergeQueueNodes: [
        { number: 7, isInMergeQueue: true, mergeQueueEntry: { position: 2, state: 'QUEUED' } },
      ],
    });
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('queued');
    expect(result?.mergeQueue).toEqual({ position: 2 });
  });

  it('leaves a PR absent from the merge queue as open', async () => {
    const pr = { ...BASE_RAW, number: 7, state: 'OPEN' as const };
    const runner = makeMergeQueueAwareRunner({
      prs: [pr],
      mergeQueueNodes: [
        { number: 99, isInMergeQueue: true, mergeQueueEntry: { position: 1, state: 'QUEUED' } },
      ],
    });
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('open');
    expect(result?.mergeQueue).toBeNull();
  });

  it('queued beats approved when autoMergeRequest present', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      reviewDecision: 'APPROVED' as const,
      autoMergeRequest: {},
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('queued');
  });

  it('OPEN + autoMergeRequest null → unchanged (mergeQueue null)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('open');
    expect(result?.mergeQueue).toBeNull();
  });

  it('draft + autoMergeRequest → still draft', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: true,
      autoMergeRequest: {},
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('draft');
  });

  it('MERGED + autoMergeRequest → merged (terminal wins)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'MERGED' as const, autoMergeRequest: {} };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('merged');
  });

  it('MERGED carries the head sha and merge time', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'MERGED' as const,
      headRefOid: 'abc123',
      mergedAt: '2026-09-20T10:00:00Z',
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.headSha).toBe('abc123');
    expect(result?.mergedAt).toBe('2026-09-20T10:00:00Z');
  });

  it('CLOSED + autoMergeRequest → closed (terminal wins)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'CLOSED' as const, autoMergeRequest: {} };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.state).toBe('closed');
  });

  it('CONFLICTING → mergeable: false', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      mergeable: 'CONFLICTING' as const,
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.mergeable).toBe(false);
  });

  it('MERGEABLE → mergeable: true', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, mergeable: 'MERGEABLE' as const };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.mergeable).toBe(true);
  });

  it('UNKNOWN → mergeable: null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, mergeable: 'UNKNOWN' as const };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.mergeable).toBeNull();
  });

  it('checks: any FAILURE → failure', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { conclusion: 'FAILURE' as const }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('failure');
  });

  it('checks: all SUCCESS → success', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { conclusion: 'SUCCESS' as const }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('success');
  });

  it('checks: mixed SUCCESS + PENDING → pending', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { state: 'PENDING' as const }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('pending');
  });

  it('checks: IN_PROGRESS run with an empty-string conclusion → pending', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [
        { conclusion: 'SUCCESS', status: 'COMPLETED' },
        { conclusion: '', status: 'IN_PROGRESS' },
      ],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('pending');
  });

  it('checks: QUEUED run with an empty-string conclusion → pending', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: '', status: 'QUEUED' }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('pending');
  });

  it('checks: STARTUP_FAILURE conclusion → failure', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [
        { conclusion: 'SUCCESS', status: 'COMPLETED' },
        { conclusion: 'STARTUP_FAILURE', status: 'COMPLETED' },
      ],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('failure');
  });

  it('checks: a run GitHub reports with no verdict at all → pending', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: '', status: '', state: '' }],
    };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBe('pending');
  });

  it('checks: empty statusCheckRollup → null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, statusCheckRollup: [] };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBeNull();
  });

  it('checks: null statusCheckRollup → null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, statusCheckRollup: null };
    const runner = makeJsonRunner([pr]);
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature');
    expect(result?.checks).toBeNull();
  });
});

describe('listPrsForBranch', () => {
  it('returns an empty list when no pull requests exist', async () => {
    const runner = makeJsonRunner([]);

    await expect(listPrsForBranch(runner, 'org/repo', 'feature')).resolves.toEqual([]);
  });

  it('rethrows GhCliError so callers can preserve cached lists', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'authentication failed', exitCode: 1 }),
    };

    await expect(listPrsForBranch(runner, 'org/repo', 'feature')).rejects.toBeInstanceOf(
      GhCliError,
    );
  });

  it('attaches merge queue placement to the listed pull requests', async () => {
    const pr = { ...BASE_RAW, number: 7, state: 'OPEN' as const };
    const runner = makeMergeQueueAwareRunner({
      prs: [pr],
      mergeQueueNodes: [
        { number: 7, isInMergeQueue: true, mergeQueueEntry: { position: 3, state: 'QUEUED' } },
      ],
    });

    const result = await listPrsForBranch(runner, 'org/repo', 'feature');

    expect(result[0]?.state).toBe('queued');
    expect(result[0]?.mergeQueue).toEqual({ position: 3 });
  });
});

describe('detectRepoSlug', () => {
  it('returns slug on success', async () => {
    const runner = makeRunner({ stdout: 'org/repo\n', stderr: '', exitCode: 0 });
    const result = await detectRepoSlug(runner, '/some/path');
    expect(result).toBe('org/repo');
  });

  it('returns null on non-zero exit', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'not a repo', exitCode: 128 });
    const result = await detectRepoSlug(runner, '/some/path');
    expect(result).toBeNull();
  });

  it('returns null when runner throws', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new Error('spawn failed')),
    };
    const result = await detectRepoSlug(runner, '/some/path');
    expect(result).toBeNull();
  });

  it('returns null when stdout is empty', async () => {
    const runner = makeRunner({ stdout: '   ', stderr: '', exitCode: 0 });
    const result = await detectRepoSlug(runner, '/some/path');
    expect(result).toBeNull();
  });
});

const SAML_STDERR =
  'HTTP 403: Resource protected by organization SAML enforcement. You must grant your token access to this organization.';

const PR = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: 'hl/fix-duplicate-credit',
  reviewDecision: null,
  updatedAt: '2026-10-05T10:00:00Z',
  body: '',
  autoMergeRequest: null,
};

const ROLLUP = [{ status: 'COMPLETED', conclusion: 'FAILURE' }];

const fieldsOf = ({ args }: { readonly args: Call }): ReadonlyArray<string> =>
  (args[args.indexOf('--json') + 1] ?? '').split(',');

type Options = {
  readonly withRollup: GhResult;
  readonly withoutRollup?: GhResult;
};

const ok = ({ data }: { readonly data: unknown }): GhResult => ({
  stdout: JSON.stringify(data),
  stderr: '',
  exitCode: 0,
});

const failure = ({ stderr }: { readonly stderr: string }): GhResult => ({
  stdout: '',
  stderr,
  exitCode: 1,
});

const runnerOf = ({
  withRollup,
  withoutRollup,
}: Options): { readonly runner: GhRunner; readonly calls: Call[] } => {
  const calls: Call[] = [];
  return {
    calls,
    runner: {
      run: async (args) => {
        calls.push(args);
        if (args.includes('graphql')) {
          return ok({ data: { repository: { pullRequests: { nodes: [] } } } });
        }
        if (fieldsOf({ args }).includes('statusCheckRollup')) {
          return withRollup;
        }
        return withoutRollup ?? failure({ stderr: 'unexpected second read' });
      },
    },
  };
};

const listCalls = ({ calls }: { readonly calls: ReadonlyArray<Call> }): ReadonlyArray<Call> =>
  calls.filter((args) => args.includes('--json'));

describe('a token that cannot read checks keeps its pull request', () => {
  describe('resolvePrForBranch', () => {
    it('retries once without statusCheckRollup and marks the checks unknown', async () => {
      const { runner, calls } = runnerOf({
        withRollup: failure({ stderr: SAML_STDERR }),
        withoutRollup: ok({ data: [PR] }),
      });

      const pr = await resolvePrForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(pr).toMatchObject({ number: 318, state: 'open', checks: null, checksUnknown: true });
      const reads = listCalls({ calls });
      expect(reads).toHaveLength(2);
      expect(fieldsOf({ args: reads[0] ?? [] })).toContain('statusCheckRollup');
      expect(fieldsOf({ args: reads[1] ?? [] })).not.toContain('statusCheckRollup');
      expect(fieldsOf({ args: reads[1] ?? [] })).toContain('reviewDecision');
    });

    it('keeps the verdict of a read that succeeds and never sets the flag', async () => {
      const { runner, calls } = runnerOf({
        withRollup: ok({ data: [{ ...PR, statusCheckRollup: ROLLUP }] }),
      });

      const pr = await resolvePrForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(pr?.checks).toBe('failure');
      expect(pr).not.toHaveProperty('checksUnknown');
      expect(listCalls({ calls })).toHaveLength(1);
    });

    it('still answers null, without a retry, when the failure is not a permission problem', async () => {
      const { runner, calls } = runnerOf({
        withRollup: failure({ stderr: 'gh: something new went wrong' }),
        withoutRollup: ok({ data: [PR] }),
      });

      const pr = await resolvePrForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(pr).toBeNull();
      expect(listCalls({ calls })).toHaveLength(1);
    });

    it('does not retry a rate limit that arrives as HTTP 403', async () => {
      const { runner, calls } = runnerOf({
        withRollup: failure({
          stderr: 'gh: API rate limit exceeded for user ID 12345. (HTTP 403)',
        }),
        withoutRollup: ok({ data: [PR] }),
      });

      const pr = await resolvePrForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(pr).toBeNull();
      expect(listCalls({ calls })).toHaveLength(1);
    });

    it('answers null when the retry is denied too', async () => {
      const { runner } = runnerOf({
        withRollup: failure({ stderr: SAML_STDERR }),
        withoutRollup: failure({ stderr: SAML_STDERR }),
      });

      const pr = await resolvePrForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(pr).toBeNull();
    });
  });

  describe('viewPullRequest', () => {
    it('retries once without statusCheckRollup and marks the checks unknown', async () => {
      const { runner, calls } = runnerOf({
        withRollup: failure({ stderr: SAML_STDERR }),
        withoutRollup: ok({ data: PR }),
      });

      const pr = await viewPullRequest({ runner, repo: 'harborline/payments-api', number: 318 });

      expect(pr).toMatchObject({ number: 318, checks: null, checksUnknown: true });
      expect(listCalls({ calls })).toHaveLength(2);
      expect(fieldsOf({ args: listCalls({ calls })[1] ?? [] })).not.toContain('statusCheckRollup');
    });

    it('still answers null when gh cannot find the pull request', async () => {
      const { runner, calls } = runnerOf({
        withRollup: failure({ stderr: 'no pull requests found' }),
      });

      const pr = await viewPullRequest({ runner, repo: 'harborline/payments-api', number: 9 });

      expect(pr).toBeNull();
      expect(listCalls({ calls })).toHaveLength(1);
    });
  });

  describe('listPrsForBranch', () => {
    it('marks every listed pull request when the first read was denied', async () => {
      const { runner } = runnerOf({
        withRollup: failure({ stderr: SAML_STDERR }),
        withoutRollup: ok({
          data: [PR, { ...PR, number: 319, updatedAt: '2026-10-04T10:00:00Z' }],
        }),
      });

      const prs = await listPrsForBranch(runner, 'harborline/payments-api', PR.headRefName);

      expect(prs.map((pr) => [pr.number, pr.checks, pr.checksUnknown])).toEqual([
        [318, null, true],
        [319, null, true],
      ]);
    });

    it('still rethrows a failure that is not a permission problem', async () => {
      const { runner } = runnerOf({
        withRollup: failure({ stderr: 'gh: something new went wrong' }),
      });

      await expect(
        listPrsForBranch(runner, 'harborline/payments-api', PR.headRefName),
      ).rejects.toMatchObject({ name: 'GhCliError' });
    });
  });
});
