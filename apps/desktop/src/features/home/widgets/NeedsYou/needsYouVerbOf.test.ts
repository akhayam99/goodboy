// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { needsYouVerbOf } from './needsYouVerbOf';

describe('needsYouVerbOf', () => {
  it('names the move: Answer a question, Review a plan, Open the rest', () => {
    expect(needsYouVerbOf({ reason: 'open-question' })).toBe('Answer');
    expect(needsYouVerbOf({ reason: 'plan-approval' })).toBe('Review plan');
    expect(needsYouVerbOf({ reason: 'ci-failed' })).toBe('Open');
    expect(needsYouVerbOf({ reason: null })).toBe('Open');
  });
});
