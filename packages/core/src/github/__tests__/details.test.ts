import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { fetchPrDetail } from '../details';

type FakeResponse = {
  match: (args: ReadonlyArray<string>) => boolean;
  result: GhResult;
};

function makeMultiRunner(responses: ReadonlyArray<FakeResponse>): GhRunner {
  return {
    run: vi.fn(async (args: ReadonlyArray<string>) => {
      for (const r of responses) {
        if (r.match(args)) {
          return r.result;
        }
      }
      return { stdout: '[]', stderr: '', exitCode: 0 };
    }),
  };
}

function jsonOk(data: unknown): GhResult {
  return { stdout: JSON.stringify(data), stderr: '', exitCode: 0 };
}

const matchIssueComments = (a: ReadonlyArray<string>) =>
  a.some((s) => s.includes('issues/1/comments'));
const matchReviewThreads = (a: ReadonlyArray<string>) => a[0] === 'api' && a[1] === 'graphql';

const emptyReviewThreads = jsonOk({
  data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } },
});

describe('fetchPrDetail', () => {
  it('merges issue + review comments sorted by createdAt', async () => {
    const runner = makeMultiRunner([
      {
        match: matchIssueComments,
        result: jsonOk([
          {
            id: 100,
            user: { login: 'alice', avatar_url: 'https://a.example/avatar.png' },
            body: 'first',
            created_at: '2026-01-01T10:00:00Z',
            html_url: 'https://github.com/org/repo/pull/1#issuecomment-100',
          },
        ]),
      },
      {
        match: matchReviewThreads,
        result: jsonOk({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRT_1',
                      isResolved: false,
                      isOutdated: false,
                      path: 'src/foo.ts',
                      line: 42,
                      comments: {
                        nodes: [
                          {
                            id: 'PRRC_1',
                            databaseId: 200,
                            author: { login: 'bob', avatarUrl: null },
                            body: 'review note',
                            createdAt: '2026-01-02T10:00:00Z',
                            url: 'https://github.com/org/repo/pull/1#discussion_r200',
                            replyTo: null,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({
          reviews: [],
          reviewRequests: [],
          statusCheckRollup: [],
        }),
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.comments.map((c) => c.author)).toEqual(['alice', 'bob']);
    expect(detail.comments[0]!.source).toBe('issue');
    expect(detail.comments[1]!.source).toBe('review');
    expect(detail.comments[1]!.path).toBe('src/foo.ts');
    expect(detail.comments[1]!.line).toBe(42);
    expect(detail.comments[1]!.resolved).toBe(false);
    expect(detail.comments[1]!.outdated).toBe(false);
    expect(detail.comments[1]!.threadId).toBe('PRT_1');
    expect(detail.comments[1]!.canResolve).toBeUndefined();
  });

  it('propagates resolved status and reply threading from review threads', async () => {
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      {
        match: matchReviewThreads,
        result: jsonOk({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRT_X',
                      isResolved: true,
                      isOutdated: true,
                      viewerCanResolve: false,
                      path: 'pkg/a.ts',
                      line: 10,
                      comments: {
                        nodes: [
                          {
                            id: 'PRRC_A',
                            databaseId: 1,
                            author: { login: 'alice', avatarUrl: null },
                            body: 'parent',
                            createdAt: '2026-01-01T10:00:00Z',
                            url: 'https://x/1',
                            replyTo: null,
                          },
                          {
                            id: 'PRRC_B',
                            databaseId: 2,
                            author: { login: 'bob', avatarUrl: null },
                            body: 'reply',
                            createdAt: '2026-01-01T11:00:00Z',
                            url: 'https://x/2',
                            replyTo: { id: 'PRRC_A' },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({ reviews: [], reviewRequests: [], statusCheckRollup: [] }),
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.comments).toHaveLength(2);
    expect(detail.comments.every((c) => c.resolved === true)).toBe(true);
    expect(detail.comments.every((c) => c.outdated === true)).toBe(true);
    expect(detail.comments.every((c) => c.canResolve === false)).toBe(true);
    expect(detail.comments[1]!.inReplyToId).toBe('review-1');
  });

  it('maps review states + review requests', async () => {
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      { match: matchReviewThreads, result: emptyReviewThreads },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({
          reviews: [
            {
              id: 1,
              author: { login: 'alice' },
              authorAssociation: 'MEMBER',
              body: 'lgtm',
              state: 'APPROVED',
              submittedAt: '2026-01-03T10:00:00Z',
            },
          ],
          reviewRequests: [{ login: 'carol', avatarUrl: 'https://x' }],
          statusCheckRollup: [],
        }),
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.reviews).toHaveLength(1);
    expect(detail.reviews[0]!.state).toBe('approved');
    expect(detail.reviewRequests).toHaveLength(1);
    expect(detail.reviewRequests[0]!.login).toBe('carol');
    expect(detail.reviewRequests[0]!.kind).toBe('user');
  });

  it('derives check conclusions including pending and failure', async () => {
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      { match: matchReviewThreads, result: emptyReviewThreads },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({
          reviews: [],
          reviewRequests: [],
          statusCheckRollup: [
            {
              name: 'build',
              status: 'completed',
              conclusion: 'success',
              detailsUrl: 'https://github.com/runs/1',
              startedAt: '2026-01-03T10:00:00Z',
              completedAt: '2026-01-03T10:01:30Z',
            },
            {
              name: 'lint',
              status: 'in_progress',
              conclusion: null,
              detailsUrl: null,
              startedAt: null,
              completedAt: null,
            },
            {
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              detailsUrl: 'https://github.com/runs/3',
              startedAt: '2026-01-03T10:00:00Z',
              completedAt: '2026-01-03T10:00:05Z',
            },
          ],
        }),
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.checks).toHaveLength(3);
    expect(detail.checks[0]!.conclusion).toBe('success');
    expect(detail.checks[0]!.durationMs).toBe(90_000);
    expect(detail.checks[1]!.conclusion).toBe('pending');
    expect(detail.checks[2]!.conclusion).toBe('failure');
  });

  it('fails the read instead of reporting zero threads when gh exits non-zero', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 1 }),
    };
    await expect(fetchPrDetail(runner, 'org/repo', 1)).rejects.toBeInstanceOf(GhCliError);
  });

  it('keeps the other pieces empty when only they fail', async () => {
    const runner = makeMultiRunner([
      {
        match: matchIssueComments,
        result: { stdout: '', stderr: 'boom', exitCode: 1 },
      },
      { match: matchReviewThreads, result: emptyReviewThreads },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: { stdout: '', stderr: 'boom', exitCode: 1 },
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.comments).toEqual([]);
    expect(detail.reviews).toEqual([]);
    expect(detail.reviewRequests).toEqual([]);
    expect(detail.checks).toEqual([]);
  });

  it('fails the read when the review threads query returns graphql errors', async () => {
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      {
        match: matchReviewThreads,
        result: jsonOk({ errors: [{ message: 'API rate limit exceeded' }] }),
      },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({ reviews: [], reviewRequests: [], statusCheckRollup: [] }),
      },
    ]);
    await expect(fetchPrDetail(runner, 'org/repo', 1)).rejects.toThrow('API rate limit exceeded');
  });

  it('reads every page of review threads instead of stopping at the first', async () => {
    const threadNode = (id: string, databaseId: number) => ({
      id,
      isResolved: false,
      isOutdated: false,
      viewerCanResolve: true,
      path: 'src/retry.ts',
      line: databaseId,
      comments: {
        nodes: [
          {
            id: `PRRC_${id}`,
            databaseId,
            author: { login: 'reviewer', avatarUrl: null },
            body: `note ${id}`,
            createdAt: `2026-01-01T10:00:${String(databaseId).padStart(2, '0')}Z`,
            url: `https://x/${databaseId}`,
            replyTo: null,
          },
        ],
      },
    });
    const pageOf = ({
      nodes,
      hasNextPage,
      endCursor,
    }: {
      readonly nodes: ReadonlyArray<ReturnType<typeof threadNode>>;
      readonly hasNextPage: boolean;
      readonly endCursor: string | null;
    }) =>
      jsonOk({
        data: {
          repository: {
            pullRequest: { reviewThreads: { pageInfo: { hasNextPage, endCursor }, nodes } },
          },
        },
      });
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      {
        match: (a) => matchReviewThreads(a) && a.includes('after=cursor-2'),
        result: pageOf({
          nodes: [threadNode('PRT_3', 3)],
          hasNextPage: false,
          endCursor: 'cursor-3',
        }),
      },
      {
        match: (a) => matchReviewThreads(a) && a.includes('after=cursor-1'),
        result: pageOf({
          nodes: [threadNode('PRT_2', 2)],
          hasNextPage: true,
          endCursor: 'cursor-2',
        }),
      },
      {
        match: matchReviewThreads,
        result: pageOf({
          nodes: [threadNode('PRT_1', 1)],
          hasNextPage: true,
          endCursor: 'cursor-1',
        }),
      },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({ reviews: [], reviewRequests: [], statusCheckRollup: [] }),
      },
    ]);
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.comments.map((c) => c.threadId)).toEqual(['PRT_1', 'PRT_2', 'PRT_3']);
    expect(detail.comments.every((c) => c.canResolve === true)).toBe(true);
  });

  it('fails the read when GitHub says there is a next page without a cursor', async () => {
    const runner = makeMultiRunner([
      { match: matchIssueComments, result: jsonOk([]) },
      {
        match: matchReviewThreads,
        result: jsonOk({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { pageInfo: { hasNextPage: true, endCursor: null }, nodes: [] },
              },
            },
          },
        }),
      },
      {
        match: (a) => a[0] === 'pr' && a[1] === 'view',
        result: jsonOk({ reviews: [], reviewRequests: [], statusCheckRollup: [] }),
      },
    ]);
    await expect(fetchPrDetail(runner, 'org/repo', 1)).rejects.toBeInstanceOf(GhCliError);
  });
});
