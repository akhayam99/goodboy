import { describe, expect, it } from 'vitest';
import { linkedIssuesOfBody } from './linkedIssuesOfBody';

describe('linkedIssuesOfBody', () => {
  it('lists each closing reference once, in number order', () => {
    const linked = linkedIssuesOfBody({ body: 'Closes #12 and fixes #4. Also resolves #12.' });
    expect(linked.map((issue) => issue.label)).toEqual(['#4', '#12']);
    expect(linked.every((issue) => issue.isClosing)).toBe(true);
  });

  it('returns nothing for a body without a closing reference', () => {
    expect(linkedIssuesOfBody({ body: 'See #3 for context' })).toEqual([]);
  });
});
