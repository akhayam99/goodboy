import { describe, expect, it } from 'vitest';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { publicationCountsLine, publishIntentSummary } from './resolvePublishCopy';

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
