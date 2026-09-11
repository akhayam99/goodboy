import { describe, expect, it } from 'vitest';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { isPublishIntentGuarded, publishIntent } from './publishIntent';

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

describe('publishIntent', () => {
  it('names a batch that pushes a commit a fix publication', () => {
    expect(
      publishIntent({
        preview: previewOf({
          requiresPush: true,
          replies: [{ threadId: 't-1', body: 'Fixed.', revision: 1, closes: true }],
        }),
      }),
    ).toBe('publish_fix');
  });

  it('separates closing a thread with no commit behind it', () => {
    expect(
      publishIntent({
        preview: previewOf({
          replies: [{ threadId: 't-1', body: 'Handled elsewhere.', revision: 1, closes: true }],
        }),
      }),
    ).toBe('close_without_fix');
  });

  it('leaves a batch that closes nothing as a plain reply', () => {
    expect(
      publishIntent({
        preview: previewOf({
          replies: [{ threadId: 't-1', body: 'Still thinking.', revision: 1, closes: false }],
        }),
      }),
    ).toBe('post_replies');
  });

  it('reads a batch whose only closures are notes as a closure with no fix', () => {
    expect(
      publishIntent({
        preview: previewOf({ notes: [{ threadId: 't-1', revision: 1, closes: true }] }),
      }),
    ).toBe('close_without_fix');
  });

  it('guards a mixed batch whose closing threads all sit in the notes', () => {
    expect(
      publishIntent({
        preview: previewOf({
          replies: [{ threadId: 't-1', body: 'Still thinking.', revision: 1, closes: false }],
          notes: [{ threadId: 't-2', revision: 1, closes: true }],
        }),
      }),
    ).toBe('close_without_fix');
  });

  it('leaves a note that closes nothing out of the gate it would arm', () => {
    expect(
      publishIntent({
        preview: previewOf({ notes: [{ threadId: 't-1', revision: 1, closes: false }] }),
      }),
    ).toBe('post_replies');
  });

  it('guards only the closure that ships no code', () => {
    expect(isPublishIntentGuarded({ intent: 'close_without_fix' })).toBe(true);
    expect(isPublishIntentGuarded({ intent: 'publish_fix' })).toBe(false);
    expect(isPublishIntentGuarded({ intent: 'post_replies' })).toBe(false);
  });
});
