// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PrComment, PrDetail, PullRequestView } from '@goodboy/types';
import {
  commentStateCountsOf,
  stateCountsInScopeOf,
  type CountableEntry,
} from '../../../resolve/commentGroupsView';
import { pullRequestActivityOf } from './activityOf';

const VIEW: PullRequestView = {
  host: 'github',
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  body: '',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  isDraft: false,
  author: { login: 'nadia-p', name: 'Harborline Dev', avatarUrl: null },
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

const NO_THREADS = { open: 0, needYou: 0 };

const kinds = (items: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<string> =>
  items.map((item) => item.kind);

describe('pullRequestActivityOf', () => {
  it('opens the list with the author and folds the pushes of one author into one row', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: null,
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(kinds(items)).toEqual(['opened', 'push']);
    expect(items[0]).toMatchObject({ kind: 'opened', who: 'nadia-p', isDraft: false });
    expect(items[1]).toMatchObject({
      kind: 'push',
      count: 3,
      sha: 'a41c9e2',
      at: '2026-10-03T12:00:00Z',
    });
  });

  it('keeps the pushes apart when another author pushed in between', () => {
    const items = pullRequestActivityOf({
      view: {
        ...VIEW,
        commits: [
          ...VIEW.commits.slice(0, 2),
          {
            sha: 'c9e1d204f7a',
            headline: 'Rename the guard',
            committedAt: '2026-09-27T09:00:00Z',
            author: 'omar-t',
          },
          ...VIEW.commits.slice(2),
        ],
      },
      detail: null,
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(items.flatMap((item) => (item.kind === 'push' ? [item.count] : []))).toEqual([2, 1, 1]);
  });

  it('keeps the pushes apart when a review lands between them', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        reviews: [
          {
            id: 'review-1',
            author: 'omar-t',
            authorAvatarUrl: null,
            state: 'approved',
            submittedAt: '2026-09-30T10:00:00Z',
            body: '',
          },
        ],
      }),
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(kinds(items)).toEqual(['opened', 'push', 'review', 'push']);
  });

  it('counts a thread left open as open, the same count the Comments tab shows', () => {
    const leftOpen: CountableEntry = {
      resolveWord: 'left_open',
      row: {
        thread: { stage: 'parked', state: 'open', stateReason: null, originKind: 'review_comment' },
      },
    };
    const tab = commentStateCountsOf({ entries: [leftOpen] });
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [comment({ id: 'review-1', threadId: 'PRT_1', resolved: false })],
      }),
      runs: null,
      threads: { open: tab.open, needYou: tab.needYou },
      entries: [],
      edits: [],
    });

    expect(tab.open).toBe(1);
    expect(items.find((item) => item.kind === 'comments')).toMatchObject({ open: 1 });
  });

  it('says all resolved for one resolved host thread while two local notes stay open', () => {
    const thread = { state: 'open', stateReason: null } as const;
    const entries: ReadonlyArray<CountableEntry> = [
      {
        resolveWord: 'done',
        row: { thread: { ...thread, stage: 'resolved', originKind: 'review_comment' } },
      },
      {
        resolveWord: 'open',
        row: { thread: { ...thread, stage: 'new', originKind: 'diff_comment' } },
      },
      {
        resolveWord: 'open',
        row: { thread: { ...thread, stage: 'new', originKind: 'diff_comment' } },
      },
    ];
    const host = stateCountsInScopeOf({ entries, scope: 'comments' });
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [comment({ id: 'review-1', threadId: 'PRT_1', resolved: true })],
      }),
      runs: null,
      threads: { open: host.open, needYou: host.needYou },
      entries: [],
      edits: [],
    });

    expect(items.find((item) => item.kind === 'comments')).toMatchObject({ total: 1, open: 0 });
  });

  it('takes the open thread count from the threads it is given', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [comment({ id: 'review-1', threadId: 'PRT_1', resolved: false })],
      }),
      runs: null,
      threads: { open: 9, needYou: 2 },
      entries: [],
      edits: [],
    });

    expect(items.find((item) => item.kind === 'comments')).toMatchObject({
      open: 9,
      needYou: 2,
    });
  });

  it('marks the comments line for the bots lane when only an app left inline findings', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [comment({ id: 'review-acme', author: 'acme-review[bot]', threadId: 'PRT_9' })],
      }),
      runs: null,
      threads: { open: 1, needYou: 0 },
      entries: [],
      edits: [],
    });

    expect(items.find((item) => item.kind === 'comments')).toMatchObject({
      hasBots: true,
      hasPeople: false,
    });
  });

  it('marks the comments line for both lanes when an app and a person commented', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [
          comment({ id: 'review-acme', author: 'acme-review[bot]', threadId: 'PRT_9' }),
          comment({ id: 'review-omar', author: 'omar-t', threadId: 'PRT_10' }),
        ],
      }),
      runs: null,
      threads: { open: 2, needYou: 0 },
      entries: [],
      edits: [],
    });

    expect(items.find((item) => item.kind === 'comments')).toMatchObject({
      hasBots: true,
      hasPeople: true,
    });
  });

  it('lets the author type of a review decide the lane of that author comments', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        comments: [comment({ id: 'review-acme', author: 'acme-bot', threadId: 'PRT_9' })],
        reviews: [
          {
            id: 'review-acme',
            author: 'acme-bot',
            authorAvatarUrl: null,
            isAuthorBot: false,
            state: 'approved',
            submittedAt: '2026-10-04T10:00:00Z',
            body: '',
          },
        ],
      }),
      runs: null,
      threads: { open: 1, needYou: 0 },
      entries: [],
      edits: [],
    });

    expect(items.find((item) => item.kind === 'comments')).toMatchObject({
      hasBots: false,
      hasPeople: true,
    });
    expect(items.find((item) => item.kind === 'review')).toMatchObject({ isBot: false });
  });

  it('gives every review of one author the same author type', () => {
    const base = {
      author: 'acme-review[bot]',
      authorAvatarUrl: null,
      submittedAt: '2026-10-04T10:00:00Z',
      body: '',
    } as const;
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        reviews: [
          { ...base, id: 'review-1', state: 'approved', isAuthorBot: true },
          { ...base, id: 'review-2', state: 'changes_requested' },
        ],
      }),
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(items.filter((item) => item.kind === 'review').map((item) => item.isBot)).toEqual([
      true,
      true,
    ]);
  });

  it('lists a review app as a bot by its author type, not as a person', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({
        reviews: [
          {
            id: 'review-acme',
            author: 'acme-review',
            authorAvatarUrl: null,
            isAuthorBot: true,
            state: 'commented',
            submittedAt: '2026-10-04T10:00:00Z',
            body: 'No issues in 4 areas.',
          },
        ],
      }),
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(kinds(items)).toEqual(['opened', 'push', 'bot']);
    expect(items[2]).toMatchObject({
      kind: 'bot',
      who: 'acme-review',
      notes: ['No issues in 4 areas.'],
    });
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
      runs: null,
      threads: NO_THREADS,
      entries: [],
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
      runs: null,
      threads: NO_THREADS,
      entries: [],
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
      runs: null,
      threads: { open: 1, needYou: 1 },
      entries: [],
      edits: [],
    });

    const line = items.find((item) => item.kind === 'comments');
    expect(line).toMatchObject({ total: 2, needYou: 1, open: 1 });
  });

  it('has no comments line while nobody commented on a file', () => {
    const items = pullRequestActivityOf({
      view: VIEW,
      detail: detail({ comments: [comment({ source: 'issue', threadId: undefined })] }),
      runs: null,
      threads: NO_THREADS,
      entries: [],
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
        runs,
        threads: NO_THREADS,
        entries: [],
        edits: [],
      }).find((item) => item.kind === 'checks');

    expect(line([run('success'), run('success')])).toMatchObject({ text: 'Checks 2 passed' });
    expect(line([run('success'), run('pending')])).toMatchObject({
      text: 'Checks 1 running',
      isRunning: true,
    });
    expect(line([run('success'), run('failure')])).toMatchObject({
      text: 'Checks 1 failing',
      isFailing: true,
    });
    expect(line([])).toBeUndefined();
  });

  it('adds the edits of this session and ends on the merge', () => {
    const items = pullRequestActivityOf({
      view: { ...VIEW, state: 'merged', mergedAt: '2026-10-07T08:00:00Z' },
      detail: null,
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [{ what: 'description', at: '2026-10-07T07:00:00Z' as IsoDateTime }],
    });

    expect(kinds(items).slice(-2)).toEqual(['edit', 'merged']);
    expect(items[items.length - 2]).toMatchObject({ what: 'description' });
  });

  it('ends a closed pull request on the close', () => {
    const items = pullRequestActivityOf({
      view: { ...VIEW, state: 'closed' },
      detail: null,
      runs: null,
      threads: NO_THREADS,
      entries: [],
      edits: [],
    });

    expect(items[items.length - 1]).toMatchObject({ kind: 'closed' });
  });
});
