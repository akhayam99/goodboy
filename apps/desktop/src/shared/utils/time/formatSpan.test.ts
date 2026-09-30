// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatSpan } from './formatSpan';

const NOW = 1_700_000_000_000;

describe('formatSpan', () => {
  it('counts seconds, minutes, hours and days with one unit', () => {
    expect(formatSpan({ from: NOW - 45_000, to: NOW })).toBe('45s');
    expect(formatSpan({ from: NOW - 90_000, to: NOW })).toBe('1m');
    expect(formatSpan({ from: NOW - 3_540_000, to: NOW })).toBe('59m');
    expect(formatSpan({ from: NOW - 5_400_000, to: NOW })).toBe('1h');
    expect(formatSpan({ from: NOW - 82_800_000, to: NOW })).toBe('23h');
    expect(formatSpan({ from: NOW - 7 * 86_400_000, to: NOW })).toBe('7d');
  });

  it('accepts ISO strings on either side', () => {
    expect(
      formatSpan({ from: new Date(NOW - 120_000).toISOString(), to: new Date(NOW).toISOString() }),
    ).toBe('2m');
  });

  it('clamps a start in the future to zero', () => {
    expect(formatSpan({ from: NOW + 10_000, to: NOW })).toBe('0s');
  });

  it('returns an empty string for a missing or invalid side', () => {
    expect(formatSpan({ from: null, to: NOW })).toBe('');
    expect(formatSpan({ from: 'nope', to: NOW })).toBe('');
    expect(formatSpan({ from: NOW, to: 'garbage' })).toBe('');
  });
});
