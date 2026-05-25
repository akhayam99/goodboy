import { describe, expect, it } from 'vitest';
import { formatRelativeDuration } from './relativeDate';

const iso = (ms: number) => new Date(ms).toISOString();
const NOW = 1_700_000_000_000;

describe('formatRelativeDuration', () => {
  it('returns seconds for < 60s', () => {
    expect(formatRelativeDuration(iso(NOW - 45_000), iso(NOW))).toBe('45s');
  });

  it('returns 0s for same timestamp', () => {
    expect(formatRelativeDuration(iso(NOW), iso(NOW))).toBe('0s');
  });

  it('returns minutes for 60s–3599s', () => {
    expect(formatRelativeDuration(iso(NOW - 90_000), iso(NOW))).toBe('1m');
    expect(formatRelativeDuration(iso(NOW - 3540_000), iso(NOW))).toBe('59m');
  });

  it('returns hours for 1h–23h', () => {
    expect(formatRelativeDuration(iso(NOW - 3_600_000), iso(NOW))).toBe('1h');
    expect(formatRelativeDuration(iso(NOW - 82_800_000), iso(NOW))).toBe('23h');
  });

  it('returns days for >= 24h', () => {
    expect(formatRelativeDuration(iso(NOW - 86_400_000), iso(NOW))).toBe('1d');
    expect(formatRelativeDuration(iso(NOW - 7 * 86_400_000), iso(NOW))).toBe('7d');
  });

  it('clamps negative diff to 0s', () => {
    expect(formatRelativeDuration(iso(NOW + 10_000), iso(NOW))).toBe('0s');
  });

  it('uses Date.now() when toIso omitted', () => {
    const result = formatRelativeDuration(new Date(Date.now() - 120_000).toISOString());
    expect(result).toBe('2m');
  });

  it('returns empty string for invalid fromIso', () => {
    expect(formatRelativeDuration('not-a-date', iso(NOW))).toBe('');
  });

  it('returns empty string for invalid toIso', () => {
    expect(formatRelativeDuration(iso(NOW), 'garbage')).toBe('');
  });
});
