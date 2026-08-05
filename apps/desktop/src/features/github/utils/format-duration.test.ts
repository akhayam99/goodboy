import { describe, expect, it } from 'vitest';
import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('returns "" for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('formats sub-second values in ms', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('rounds to seconds at the one-second boundary', () => {
    expect(formatDuration(1_000)).toBe('1s');
  });

  it('formats whole seconds under a minute', () => {
    expect(formatDuration(5_000)).toBe('5s');
  });

  it('formats minutes with a seconds remainder', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
  });

  it('omits the seconds remainder on a whole minute', () => {
    expect(formatDuration(120_000)).toBe('2m');
  });
});
