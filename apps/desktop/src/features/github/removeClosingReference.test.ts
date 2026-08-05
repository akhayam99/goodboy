import { describe, expect, it } from 'vitest';
import { closingReferenceLines } from './closingReferenceLines';
import { removeClosingReference } from './removeClosingReference';

describe('removeClosingReference', () => {
  it('drops only the line closing that issue', () => {
    const body = 'Refactors auth.\n\nCloses #9\nCloses #12';
    expect(removeClosingReference({ body, number: 9 })).toBe('Refactors auth.\n\nCloses #12');
  });

  it('leaves a prose mention of the issue alone', () => {
    const body = 'Follows up on fixes #9 from last week.\n\nCloses #12';
    expect(removeClosingReference({ body, number: 9 })).toBe(body);
  });
});

describe('closingReferenceLines', () => {
  it('reads only the standalone closing lines it can rewrite', () => {
    const body = 'Resolves #3 in passing.\n\nFixes #9\ncloses #12.';
    expect([...closingReferenceLines({ body })]).toEqual([9, 12]);
  });
});
