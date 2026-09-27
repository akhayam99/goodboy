import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { listInboxPullRequests } from '../inboxPrs';

type RawOverrides = {
  readonly number: number;
  readonly title: string;
  readonly updatedAt: string;
  readonly isDraft?: boolean;
  readonly reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
};

const rawPr = ({
  number,
  title,
  updatedAt,
  isDraft = false,
  reviewDecision = null,
}: RawOverrides) => ({
  number,
  title,
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state: 'OPEN',
  isDraft,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: `feature-${number}`,
  reviewDecision,
  statusCheckRollup: [],
  updatedAt,
  body: null,
  autoMergeRequest: null,
  headRefOid: `sha-${number}`,
  mergedAt: null,
});

const ok = (value: unknown) => ({ stdout: JSON.stringify(value), stderr: '', exitCode: 0 });

describe('listInboxPullRequests', () => {
  it('asks gh for review requests and own open prs updated in the last week', async () => {
    const run = vi.fn().mockResolvedValue(ok([]));
    const runner: GhRunner = { run };

    await listInboxPullRequests({
      runner,
      repoSlug: 'harborline/ledger-core',
      now: new Date('2026-09-27T12:00:00Z'),
      opts: { cwd: '/repos/ledger-core', workspaceId: 'workspace-1' },
    });

    const searches = run.mock.calls.map((call) => {
      const args = call[0] as ReadonlyArray<string>;
      return args[args.indexOf('--search') + 1];
    });
    expect(searches).toEqual(['review-requested:@me', 'author:@me updated:>=2026-09-20']);
    const [firstArgs, firstOpts] = run.mock.calls[0] as [ReadonlyArray<string>, unknown];
    expect(firstArgs.slice(0, 6)).toEqual([
      'pr',
      'list',
      '--repo',
      'harborline/ledger-core',
      '--state',
      'open',
    ]);
    expect(firstArgs).toContain('--json');
    expect(firstOpts).toEqual({ cwd: '/repos/ledger-core', workspaceId: 'workspace-1' });
  });

  it('merges both lists, keeps the review role on overlap, and sorts by activity', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(
        ok([
          rawPr({ number: 12, title: 'Retry ledger sync', updatedAt: '2026-09-25T10:00:00Z' }),
          rawPr({ number: 14, title: 'Shared fix', updatedAt: '2026-09-24T10:00:00Z' }),
        ]),
      )
      .mockResolvedValueOnce(
        ok([
          rawPr({
            number: 14,
            title: 'Shared fix',
            updatedAt: '2026-09-24T10:00:00Z',
          }),
          rawPr({
            number: 20,
            title: 'Batch payouts',
            updatedAt: '2026-09-26T10:00:00Z',
            reviewDecision: 'CHANGES_REQUESTED',
          }),
        ]),
      );
    const runner: GhRunner = { run };

    const result = await listInboxPullRequests({
      runner,
      repoSlug: 'harborline/ledger-core',
      now: new Date('2026-09-27T12:00:00Z'),
    });

    expect(result.map(({ pr, role }) => [pr.number, role])).toEqual([
      [20, 'author'],
      [12, 'review-requested'],
      [14, 'review-requested'],
    ]);
    expect(result[0]?.pr).toMatchObject({
      state: 'open',
      reviewDecision: 'changes_requested',
      headBranch: 'feature-20',
      baseBranch: 'main',
      body: '',
    });
  });

  it('maps a draft pr to the draft state', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(
        ok([
          rawPr({
            number: 3,
            title: 'Draft ledger',
            updatedAt: '2026-09-25T10:00:00Z',
            isDraft: true,
          }),
        ]),
      )
      .mockResolvedValueOnce(ok([]));
    const runner: GhRunner = { run };

    const result = await listInboxPullRequests({
      runner,
      repoSlug: 'harborline/ledger-core',
      now: new Date('2026-09-27T12:00:00Z'),
    });

    expect(result[0]?.pr.state).toBe('draft');
  });
});
