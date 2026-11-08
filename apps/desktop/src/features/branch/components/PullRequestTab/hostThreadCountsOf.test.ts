import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestReviewer } from '@goodboy/types';
import { evaluatePrMergeReadiness } from '../../../review/prMergeReadiness';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import { hostThreadCountsOf } from './hostThreadCountsOf';
import { mergeBoxOf } from './MergeBox/mergeBoxOf';

const BOT_THREAD: PrComment = {
  id: 'a',
  author: 'cascadia-lint[bot]',
  authorAvatarUrl: null,
  body: 'Retry cap check misses the 429 path',
  createdAt: '2026-11-07T10:00:00Z',
  url: 'https://github.com/northwind/payments-api/pull/318#a',
  source: 'review',
  resolved: false,
  threadId: 'thread-a',
};

const RESOLVED_THREAD: PrComment = { ...BOT_THREAD, id: 'b', threadId: 'thread-b', resolved: true };

const LOADED: ReadonlyArray<ThreadEntry> = [
  {
    threadId: 'thread-a',
    resolveWord: 'open',
    row: {
      thread: { stage: 'new', state: 'open', stateReason: null, originKind: 'review_comment' },
    },
  },
];

const APPROVER: PullRequestReviewer = {
  person: { login: 'kenji-w', name: null, avatarUrl: null },
  state: 'approved',
};

type BoxParams = {
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
};

const boxOf = ({ comments, entries }: BoxParams) => {
  const counts = hostThreadCountsOf({ comments, entries });
  const facts = {
    pr: { baseBranch: 'main', mergeable: true },
    phase: 'open',
    checks: 'green',
    failingChecks: [],
    runningChecks: 0,
    review: 'approved',
    changesRequestedBy: [],
    hasConflicts: false,
    writeInFlight: null,
    commentsNeedYou: counts.needYou,
    isFixRunLive: false,
  } as const;
  return mergeBoxOf({
    state: 'open',
    pr: { baseBranch: 'main', reviewDecision: 'approved', mergeable: true },
    runs: [],
    isChecksUnread: false,
    checks: { checks: 'green', failingChecks: [], runningChecks: 0 },
    reviewers: [APPROVER],
    readiness: evaluatePrMergeReadiness({ facts }),
    hasConflicts: false,
    mergeWord: 'Squash and merge',
    queueLine: null,
    branch: { ahead: 1, behind: 0, onlineAhead: 0, isRebasing: false },
    threads: { unresolved: counts.open, needYou: counts.needYou, unread: 0 },
    unpushed: 0,
    canRequestReview: true,
  });
};

describe('hostThreadCountsOf', () => {
  it('counts an unresolved host thread head as open while the entries are not loaded', () => {
    expect(hostThreadCountsOf({ comments: [BOT_THREAD, RESOLVED_THREAD], entries: [] })).toEqual({
      open: 1,
      resolved: 0,
      needYou: 1,
    });
  });

  it('reads the same numbers once the entries load', () => {
    const comments = [BOT_THREAD, RESOLVED_THREAD];

    expect(hostThreadCountsOf({ comments, entries: LOADED })).toEqual(
      hostThreadCountsOf({ comments, entries: [] }),
    );
  });

  it('reads only the loaded entries, so a host thread outside the queue never adds one', () => {
    const outside: PrComment = { ...BOT_THREAD, id: 'e', threadId: 'thread-e' };

    expect(hostThreadCountsOf({ comments: [BOT_THREAD, outside], entries: LOADED })).toEqual({
      open: 1,
      resolved: 0,
      needYou: 1,
    });
  });

  it('counts nothing for replies and issue comments', () => {
    const reply: PrComment = { ...BOT_THREAD, id: 'c', inReplyToId: 'a' };
    const summary: PrComment = { ...BOT_THREAD, id: 'd', threadId: 'thread-d', source: 'issue' };

    expect(hostThreadCountsOf({ comments: [reply, summary], entries: [] })).toEqual({
      open: 0,
      resolved: 0,
      needYou: 0,
    });
  });

  it('keeps the merge box blocked on the open thread before and after the entries load', () => {
    const before = boxOf({ comments: [BOT_THREAD], entries: [] });
    const after = boxOf({ comments: [BOT_THREAD], entries: LOADED });

    expect(before.verdict).toMatchObject({ kind: 'blocked', word: 'Not ready to merge' });
    expect(before.rows.map((row) => row.title)).toEqual(['1 thread needs you']);
    expect(after).toEqual(before);
  });
});
