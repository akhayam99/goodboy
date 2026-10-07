import { describe, expect, it } from 'vitest';
import { pullRequestWord } from './pullRequestWord';

describe('pullRequestWord', () => {
  it('says Closed and Merged for a pull request that GitHub still flags as a draft', () => {
    expect(pullRequestWord({ state: 'closed', isDraft: true })).toBe('Closed');
    expect(pullRequestWord({ state: 'merged', isDraft: true })).toBe('Merged');
  });

  it('says Draft for a live draft and the capitalised word otherwise', () => {
    expect(pullRequestWord({ state: 'open', isDraft: true })).toBe('Draft');
    expect(pullRequestWord({ state: 'draft', isDraft: true })).toBe('Draft');
    expect(pullRequestWord({ state: 'open', isDraft: false })).toBe('Open');
    expect(pullRequestWord({ state: 'queued', isDraft: false })).toBe('Queued');
    expect(pullRequestWord({ state: 'approved', isDraft: false })).toBe('Approved');
  });
});
