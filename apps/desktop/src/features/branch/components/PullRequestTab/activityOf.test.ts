// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PrComment, PrDetail, PullRequestView } from '@goodboy/types';
import { pullRequestActivityOf } from './activityOf';

const VIEW: PullRequestView = {
  host: 'github',
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  body: '',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  isDraft: false,
  author: { login: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null },
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  headSha: 'a41c9e2b7d3',
  createdAt: '2026-09-26T08:00:00Z',
  updatedAt: '2026-10-06T09:30:00Z',
  mergedAt: null,
  mergeable: true,
  reviewDecision: null,
  reviewers: [],
  resolves: [],
  checks: { read: 'ok', error: null, runs: [] },
  files: { count: 0, first: [] },
  commits: [
    {
      sha: '6c20f48a9e1',
      headline: 'Key the guard on the event id',
      committedAt: '2026-09-26T07:50:00Z',
      author: 'nadia-p',
    },
    {
      sha: 'b7d0c11e4aa',
      headline: 'Add the retry test',
      committedAt: '2026-09-26T09:10:00Z',
      author: 'nadia-p',
    },
    {
      sha: 'a41c9e2b7d3',
      headline: 'Drop the seenEvents read',
      committedAt: '2026-10-03T12:00:00Z',
      author: 'nadia-p',
    },
  ],
  mergeMethods: ['squash', 'merge', 'rebase'],
  mergeMethodReasons: {},
};

const comment = (patch: Partial<PrComment>): PrComment => ({
  id: 'review-1',
  author: 'omar-t',
  authorAvatarUrl: null,
  body: 'Cap the retries',
  createdAt: '2026-10-02T10:00:00Z',
  url: 'https://github.com/harborline/payments-api/pull/318#discussion_r1',
  source: 'review',
  threadId: 'PRT_1',
  resolved: false,
  ...patch,
});

const detail = (patch: Partial<PrDetail>): PrDetail => ({
  prNumber: 318,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  ...patch,
});

const kinds = (items: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<string> =>
  items.map((item) => item.kind);

describe('pullRequestActivityOf', () => {
  it('opens the list with the author and groups the pushes by day', () => {
    const items = pullRequestActivityOf({ view: VIEW, detail: null, needYou: 0, edits: [] });

    expect(kinds(items)).toEqual(['opened', 'push', 'push']);
    expect(items[0]).toMatchObject({ kind: 'opened', who: 'nadia-p', isDraft: false });
    expect(items[1]).toMatchObject({ kind: 'push', count: 2, sha: 'b7d0c11' });
    expect(items[2]).toMatchObject({ kind: 'push', count: 1, sha: 'a41c9e2' });
  });

  it('interleaves the reviews with the pushes by time, newest last', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        reviews: [
          {
            id: 'review-2',
            author: 'kenji-w',
            authorAvatarUrl: null,
            state: 'approved',
            submittedAt: '2026-10-04T10:00:00Z',
            body: 'The event id is the right key.',
          },
          {
            id: 'review-1',
            author: 'omar-t',
            authorAvatarUrl: null,
            state: 'changes_requested',
            submittedAt: '2026-10-02T10:00:00Z',
            body: 'Please drop the read.',
          },
        ],
      }),
      needYou: 0,
      edits: [],
    });

    expect(kinds(items)).toEqual(['opened', 'push', 'review', 'push', 'review']);
    expect(items.flatMap((item) => (item.kind === 'review' ? [item.who] : []))).toEqual([
      'omar-t',
      'kenji-w',
    ]);
  });

  it('skips a pending review, a dismissed one and a comment review with no text', () => {
    const base = {
      authorAvatarUrl: null,
      submittedAt: '2026-10-04T10:00:00Z',
    };
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        reviews: [
          { ...base, id: 'a', author: 'a', state: 'pending', body: '' },
          { ...base, id: 'b', author: 'b', state: 'dismissed', body: 'old' },
          { ...base, id: 'c', author: 'c', state: 'commented', body: '  ' },
          { ...base, id: 'd', author: 'd', state: 'commented', body: 'Nice' },
        ],
      }),
      needYou: 0,
      edits: [],
    });

    expect(items.filter((item) => item.kind === 'review')).toHaveLength(1);
  });

  it('folds the review threads into one line that counts the ones that need the owner', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [
          comment({ id: 'review-1', threadId: 'PRT_1' }),
          comment({ id: 'review-2', threadId: 'PRT_1', createdAt: '2026-10-02T11:00:00Z' }),
          comment({ id: 'review-3', threadId: 'PRT_2', resolved: true }),
          comment({ id: 'issue-4', source: 'issue', threadId: undefined }),
        ],
      }),
      needYou: 1,
      edits: [],
    });

    const line = items.find((item) => item.kind === 'comments');
    expect(line).toMatchObject({ total: 2, needYou: 1, open: 1 });
  });

  it('has no comments line while nobody commented on a file', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({ comments: [comment({ source: 'issue', threadId: undefined })] }),
      needYou: 0,
      edits: [],
    });

    expect(kinds(items)).not.toContain('comments');
  });

  it('words the checks line from the runs', () => {
    const run = (conclusion: 'success' | 'failure' | 'pending') => ({
      name: 'unit',
      conclusion,
      detailsUrl: null,
      durationMs: null,
    });
    const line = (runs: PullRequestView['checks']['runs']) =>
      pullRequestActivityOf({
        view: { ...VIEW, checks: { read: 'ok', error: null, runs } },
        detail: null,
        needYou: 0,
        edits: [],
      }).find((item) => item.kind === 'checks');

    expect(line([run('success'), run('success')])).toMatchObject({ text: 'All 2 passed' });
    expect(line([run('success'), run('pending')])).toMatchObject({
      text: '1 check passed, 1 running',
      isRunning: true,
    });
    expect(line([run('success'), run('failure')])).toMatchObject({
      text: '1 check failing, 1 passed',
      isFailing: true,
    });
    expect(line([])).toBeUndefined();
  });

  it('adds the edits of this session and ends on the merge', () => {
    const items = pullRequestActivityOf({
      view: { ...VIEW, state: 'merged', mergedAt: '2026-10-07T08:00:00Z' },
      detail: null,
      needYou: 0,
      edits: [{ what: 'description', at: '2026-10-07T07:00:00Z' as IsoDateTime }],
    });

    expect(kinds(items).slice(-2)).toEqual(['edit', 'merged']);
    expect(items[items.length - 2]).toMatchObject({ what: 'description' });
  });

  it('ends a closed pull request on the close', () => {
    const items = pullRequestActivityOf({
      view: { ...VIEW, state: 'closed' },
      detail: null,
      needYou: 0,
      edits: [],
    });

    expect(items[items.length - 1]).toMatchObject({ kind: 'closed' });
  });
});
