import { describe, expect, it } from 'vitest';
import { epochSecondsToIso } from './epochSecondsToIso';

describe('epochSecondsToIso', () => {
  it('turns epoch seconds into an ISO time', () => {
    expect(epochSecondsToIso({ value: 1_790_000_000 })).toBe('2026-09-21T14:13:20.000Z');
  });

  it.each([['1790000000'], [0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'reads %s as no reset time',
    (value) => {
      expect(epochSecondsToIso({ value })).toBeNull();
    },
  );

  it('reads a finite time past the date range as no reset time instead of throwing', () => {
    expect(epochSecondsToIso({ value: 1e16 })).toBeNull();
  });
});
