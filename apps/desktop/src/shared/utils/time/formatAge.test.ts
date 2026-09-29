// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatAge } from './formatAge';

const NOW = 1_700_000_000_000;

describe('formatAge', () => {
  it('says just now under a minute', () => {
    expect(formatAge({ from: NOW - 20_000, now: NOW })).toBe('just now');
    expect(formatAge({ from: NOW + 5_000, now: NOW })).toBe('just now');
  });

  it('climbs minutes, hours and days with ago', () => {
    expect(formatAge({ from: NOW - 5 * 60_000, now: NOW })).toBe('5m ago');
    expect(formatAge({ from: NOW - 2 * 3_600_000, now: NOW })).toBe('2h ago');
    expect(formatAge({ from: NOW - 3 * 86_400_000, now: NOW })).toBe('3d ago');
  });

  it('reads 90 minutes as 1h ago, the same rung the duration uses', () => {
    expect(formatAge({ from: NOW - 90 * 60_000, now: NOW })).toBe('1h ago');
  });

  it('returns an empty string for a missing or invalid timestamp', () => {
    expect(formatAge({ from: null, now: NOW })).toBe('');
    expect(formatAge({ from: 'nope', now: NOW })).toBe('');
  });
});
