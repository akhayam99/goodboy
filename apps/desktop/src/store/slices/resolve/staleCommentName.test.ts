// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import { staleCommentName } from './staleCommentName';

const comment = (overrides: Partial<PrComment>): PrComment => ({
  id: 'comment-1',
  author: 'Mara Cole',
  authorAvatarUrl: null,
  body: 'Round the credit note',
  createdAt: '2026-10-05T10:00:00.000Z',
  url: 'https://example.test/pull/7#comment-1',
  source: 'review',
  ...overrides,
});

describe('staleCommentName', () => {
  it('names a review comment by its file and line', () => {
    expect(
      staleCommentName({
        head: comment({ path: 'libraries/ledger-core/src/credit.ts', line: 42 }),
      }),
    ).toBe('The comment on libraries/ledger-core/src/credit.ts:42');
  });

  it('names a review comment without a line by its file alone', () => {
    expect(
      staleCommentName({ head: comment({ path: 'libraries/ledger-core/src/credit.ts' }) }),
    ).toBe('The comment on libraries/ledger-core/src/credit.ts');
  });

  it('names a comment on the conversation by its author', () => {
    expect(staleCommentName({ head: comment({ source: 'issue' }) })).toBe(
      'The comment by Mara Cole',
    );
  });

  it('says a comment before this one when the thread is not on screen', () => {
    expect(staleCommentName({ head: null })).toBe('A comment before this one');
  });
});
