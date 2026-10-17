// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ISSUE_SEARCH_PLACEHOLDER } from './lookupCopy';

describe('lookupCopy', () => {
  it('keeps the search placeholder to two short ideas', () => {
    expect(ISSUE_SEARCH_PLACEHOLDER).toBe('Search or paste a link');
  });
});
