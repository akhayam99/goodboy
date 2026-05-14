import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { fetchPrDetail } from '../details';

interface FakeResponse {
  match: (args: ReadonlyArray<string>) => boolean;
  result: GhResult;
}

function makeMultiRunner(responses: ReadonlyArray<FakeResponse>): GhRunner {
  return {
    run: vi.fn(async (args: ReadonlyArray<string>) => {
      for (const r of responses) {
        if (r.match(args)) return r.result;
      }
      return { stdout: '[]', stderr: '', exitCode: 0 };
    }),
  };
}

function jsonOk(data: unknown): GhResult {
  return { stdout: JSON.stringify(data), stderr: '', exitCode: 0 };
}

describe('fetchPrDetail', () => {
  it('merges issue + review comments sorted by createdAt', async () => {
    const runner = makeMultiRunner([
      {
        match: (a) => a.some((s) => s.includes('issues/1/comments')),
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
        match: (a) => a.some((s) => s.includes('pulls/1/comments')),
        result: jsonOk([
          {
            id: 200,
            user: { login: 'bob', avatar_url: null },
            body: 'review note',
            created_at: '2026-01-02T10:00:00Z',
            html_url: 'https://github.com/org/repo/pull/1#discussion_r200',
          },
        ]),
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
  });

  it('maps review states + review requests', async () => {
    const runner = makeMultiRunner([
      { match: (a) => a.some((s) => s.includes('issues/1/comments')), result: jsonOk([]) },
      { match: (a) => a.some((s) => s.includes('pulls/1/comments')), result: jsonOk([]) },
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
      { match: (a) => a.some((s) => s.includes('issues/1/comments')), result: jsonOk([]) },
      { match: (a) => a.some((s) => s.includes('pulls/1/comments')), result: jsonOk([]) },
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

  it('returns empty pieces when gh exits non-zero', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 1 }),
    };
    const detail = await fetchPrDetail(runner, 'org/repo', 1);
    expect(detail.comments).toEqual([]);
    expect(detail.reviews).toEqual([]);
    expect(detail.reviewRequests).toEqual([]);
    expect(detail.checks).toEqual([]);
  });
});
