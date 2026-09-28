import { describe, expect, it } from 'vitest';
import type { ResolvePublicationPreview } from '@goodboy/types';
import type { PublicationOutcome } from '../../store/slices/resolve/publicationOutcome';
import { pushConfirmBody, pushConfirmTitle, pushResultOf, pushStyleNote } from './reviewPushCopy';

const previewOf = (patch: Partial<ResolvePublicationPreview>): ResolvePublicationPreview => ({
  publicationId: 'pub-1',
  repo: 'harborline/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [
    {
      sha: 'a41c9e2aaaa',
      shortSha: 'a41c9e2',
      subject: 'Cap webhook retries',
      author: 'resolver',
      timestamp: 1,
      pushed: false,
      parentSha: null,
      threadIds: ['t-backoff'],
    },
  ],
  unapproved: [],
  replies: [
    { threadId: 't-backoff', body: 'Capped at 6.', revision: 1, closes: true },
    { threadId: 't-shape', body: 'A 502 with the event id.', revision: 1, closes: true },
  ],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
  ...patch,
});

const outcomeOf = (patch: Partial<PublicationOutcome>): PublicationOutcome => ({
  pushed: true,
  pushedHead: 'a41c9e2aaaa',
  total: 3,
  replies: 3,
  replied: 3,
  closed: 3,
  resolved: 3,
  leftOpen: 0,
  failed: 0,
  error: null,
  ...patch,
});

describe('the push confirm', () => {
  it('names what goes out, where, and the commit style', () => {
    const preview = previewOf({});

    expect(pushConfirmTitle({ preview })).toBe('Push 2 to hl/fix-duplicate-credit?');
    expect(pushConfirmBody({ preview, commitStyle: 'new' })).toBe(
      '1 fix in 1 new commit, 2 replies, 2 threads resolved on GitHub.',
    );
    expect(pushConfirmBody({ preview, commitStyle: 'fixup' })).toBe(
      '1 fix in 1 fixup commit, 2 replies, 2 threads resolved on GitHub.',
    );
    expect(pushStyleNote({ commitStyle: 'fixup' })).toContain('fixups');
  });

  it('says when no commit goes out and points at the pull request instead of a branch', () => {
    const preview = previewOf({ requiresPush: false, commits: [] });

    expect(pushConfirmTitle({ preview })).toBe('Push 2 to #318?');
    expect(pushConfirmBody({ preview, commitStyle: 'new' })).toBe(
      'No commit, 2 replies, 2 threads resolved on GitHub.',
    );
  });

  it('counts a resolve-only comment once, with no reply', () => {
    const preview = previewOf({
      requiresPush: false,
      commits: [],
      replies: [],
      notes: [{ threadId: 't-nit', revision: 2, closes: true }],
    });

    expect(pushConfirmTitle({ preview })).toBe('Push 1 to #318?');
    expect(pushConfirmBody({ preview, commitStyle: 'new' })).toBe(
      'No commit, 1 thread resolved on GitHub.',
    );
  });
});

describe('the push result line', () => {
  it('names the commit and what landed when everything did', () => {
    expect(pushResultOf({ outcome: outcomeOf({}) })).toEqual({
      tone: 'done',
      sentence: 'Pushed a41c9e2, 3 replies posted, 3 threads resolved on GitHub.',
    });
  });

  it('says how many landed and points at the one that did not', () => {
    expect(pushResultOf({ outcome: outcomeOf({ failed: 1, error: 'locked' }) })).toEqual({
      tone: 'partial',
      sentence: '2 of 3 landed in a41c9e2. 1 did not: see the comment.',
    });
  });

  it('keeps threads GitHub left open apart from the resolved ones', () => {
    expect(
      pushResultOf({ outcome: outcomeOf({ pushedHead: null, resolved: 1, leftOpen: 2 }) }),
    ).toEqual({
      tone: 'done',
      sentence: '3 replies posted, 1 thread resolved on GitHub, 2 left open for the reviewer.',
    });
  });

  it('reads as a failure when nothing landed', () => {
    expect(pushResultOf({ outcome: outcomeOf({ pushedHead: null, failed: 3 }) }).tone).toBe(
      'failed',
    );
  });
});
