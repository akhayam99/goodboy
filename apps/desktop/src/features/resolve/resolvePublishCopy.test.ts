import { describe, expect, it } from 'vitest';
import type { ResolvePublicationPreview } from '@goodboy/types';
import type { PublicationOutcome } from '../../store/slices/resolve/publicationOutcome';
import {
  publicationCountsLine,
  publicationOutcomeSentence,
  publishIntentSummary,
} from './resolvePublishCopy';

const previewOf = (patch: Partial<ResolvePublicationPreview>): ResolvePublicationPreview => ({
  publicationId: 'pub-1',
  repo: 'acme/web',
  prNumber: 7,
  branch: 'feature/retry',
  localHead: 'aaaaaaa',
  remoteHead: 'bbbbbbb',
  requiresPush: false,
  frozenAt: 1,
  commits: [],
  unapproved: [],
  replies: [],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
  ...patch,
});

describe('the publish confirmation copy', () => {
  it('restates a notes-only batch at the scope the counts line already claims', () => {
    const preview = previewOf({ notes: [{ threadId: 't-1', revision: 1, closes: true }] });

    expect(publicationCountsLine({ preview })).toBe('1 thread to resolve');
    expect(publishIntentSummary({ preview })).toBe('1 thread to resolve. 1 thread on #7');
  });

  it('keeps the scope and the counts line on one number in a mixed batch', () => {
    const preview = previewOf({
      replies: [{ threadId: 't-1', body: 'Fixed.', revision: 1, closes: true }],
      notes: [{ threadId: 't-2', revision: 1, closes: true }],
    });

    expect(publicationCountsLine({ preview })).toBe('1 reply to post · 2 threads to resolve');
    expect(publishIntentSummary({ preview })).toBe(
      '1 reply to post · 2 threads to resolve. 2 threads on #7',
    );
  });

  it('leaves a batch that closes nothing without a resolve count', () => {
    const preview = previewOf({
      replies: [{ threadId: 't-1', body: 'Still thinking.', revision: 1, closes: false }],
      notes: [{ threadId: 't-2', revision: 1, closes: false }],
    });

    expect(publicationCountsLine({ preview })).toBe('1 reply to post');
    expect(publishIntentSummary({ preview })).toBe('1 reply to post. 0 threads on #7');
  });
});

const outcomeOf = (patch: Partial<PublicationOutcome>): PublicationOutcome => ({
  pushed: true,
  pushedHead: '4f21c8b90000',
  total: 4,
  replies: 4,
  replied: 4,
  closed: 4,
  resolved: 4,
  leftOpen: 0,
  failed: 0,
  error: null,
  ...patch,
});

describe('publicationOutcomeSentence', () => {
  it('names the pushed commit, the replies and the resolved threads when all landed', () => {
    expect(publicationOutcomeSentence({ outcome: outcomeOf({}) })).toBe(
      'Closed 4 on GitHub. 4f21c8b pushed, 4 replies posted, 4 threads resolved.',
    );
  });

  it('says what already happened before naming the failure', () => {
    expect(
      publicationOutcomeSentence({
        outcome: outcomeOf({
          replied: 3,
          closed: 3,
          resolved: 3,
          failed: 1,
          error: 'rate limited by GitHub',
        }),
      }),
    ).toBe(
      '4f21c8b pushed, 3 of 4 replies posted, 3 threads resolved. 1 failed: rate limited by GitHub.',
    );
  });

  it('counts threads GitHub kept open apart from the resolved ones', () => {
    expect(
      publicationOutcomeSentence({
        outcome: outcomeOf({
          pushed: false,
          pushedHead: null,
          total: 2,
          replies: 2,
          replied: 2,
          closed: 2,
          resolved: 1,
          leftOpen: 1,
        }),
      }),
    ).toBe('Closed 2 on GitHub. 2 replies posted, 1 thread resolved, 1 left open.');
  });
});
