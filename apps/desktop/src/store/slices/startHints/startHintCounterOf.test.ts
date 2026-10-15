import { describe, expect, it } from 'vitest';
import { startHintCounterOf } from './startHintCounterOf';

describe('the hint counter', () => {
  it.each([0, 1, 1799])('shows nothing at %i characters', (length) => {
    expect(startHintCounterOf({ length })).toBeNull();
  });

  it.each([
    [1800, '1800 of 2000'],
    [2000, '2000 of 2000'],
  ])('shows the count at %i characters', (length, expected) => {
    expect(startHintCounterOf({ length })).toBe(expected);
  });
});
