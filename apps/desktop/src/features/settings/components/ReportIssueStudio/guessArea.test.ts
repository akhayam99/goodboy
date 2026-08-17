import { describe, expect, it } from 'vitest';
import { guessArea } from './guessArea';

describe('guessArea', () => {
  it('returns null when no keyword matches', () => {
    expect(guessArea({ text: 'The screen feels odd' })).toBeNull();
  });

  it('counts each keyword once and supports Italian reports', () => {
    expect(guessArea({ text: 'Il costo supera il budget. Budget budget budget.' })).toBe(
      'budget-spend',
    );
  });

  it('uses word boundaries for single words', () => {
    expect(guessArea({ text: 'The cardinal direction changed' })).toBeNull();
  });

  it('matches phrases and resolves score ties by earliest match', () => {
    expect(guessArea({ text: 'Pull request fails after a provider update' })).toBe('reviews');
  });

  it('never guesses the catch-all area', () => {
    expect(guessArea({ text: 'Something else happened on GitHub' })).toBeNull();
  });
});
