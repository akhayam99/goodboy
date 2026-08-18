import { describe, expect, it } from 'vitest';
import { orderSuggestions } from '.';

describe('orderSuggestions', () => {
  it('lifts the recommended answer to the front when it arrived later', () => {
    expect(
      orderSuggestions({
        suggestions: ['refactor non ancora fatto', 'il refactor è su un altro branch', 'rilancia'],
        recommendedAnswer: 'il refactor è su un altro branch',
      }),
    ).toEqual(['il refactor è su un altro branch', 'refactor non ancora fatto', 'rilancia']);
  });

  it('keeps the recommended answer first when it already arrived first', () => {
    expect(
      orderSuggestions({ suggestions: ['sqlite', 'postgres'], recommendedAnswer: 'sqlite' }),
    ).toEqual(['sqlite', 'postgres']);
  });

  it('prepends a recommended answer that is not among the suggestions', () => {
    expect(
      orderSuggestions({ suggestions: ['sqlite', 'postgres'], recommendedAnswer: 'use both' }),
    ).toEqual(['use both', 'sqlite', 'postgres']);
  });

  it('leaves the arrival order alone when nothing is recommended', () => {
    expect(
      orderSuggestions({ suggestions: ['postgres', 'sqlite', 'duckdb'], recommendedAnswer: '' }),
    ).toEqual(['postgres', 'sqlite', 'duckdb']);
  });

  it('returns nothing for an empty list, recommended or not', () => {
    expect(orderSuggestions({ suggestions: [], recommendedAnswer: '' })).toEqual([]);
  });

  it('drops a repeated suggestion so every row stands for one answer', () => {
    expect(
      orderSuggestions({ suggestions: ['yes', 'no', 'yes'], recommendedAnswer: 'no' }),
    ).toEqual(['no', 'yes']);
  });
});
