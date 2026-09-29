// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('keeps the small units the transcript needs', () => {
    expect(formatDuration({ durationMs: 420 })).toBe('420ms');
    expect(formatDuration({ durationMs: 8_000 })).toBe('8s');
    expect(formatDuration({ durationMs: 90_000 })).toBe('1m 30s');
    expect(formatDuration({ durationMs: 120_000 })).toBe('2m');
  });

  it('rolls minutes into hours instead of counting to four figures', () => {
    expect(formatDuration({ durationMs: 3_600_000 })).toBe('1h');
    expect(formatDuration({ durationMs: 7_205_000 })).toBe('2h');
    expect(formatDuration({ durationMs: 15_000_000 })).toBe('4h 10m');
    expect(formatDuration({ durationMs: 111_890_000 })).not.toContain('1864m');
  });

  it('rolls hours into days for a run that outlives a night', () => {
    expect(formatDuration({ durationMs: 172_800_000 })).toBe('2d');
    expect(formatDuration({ durationMs: 183_600_000 })).toBe('2d 3h');
  });

  it('carries a rounded-up minute into the next unit', () => {
    expect(formatDuration({ durationMs: 59_600 })).toBe('1m');
  });

  it('shows tenths under ten seconds only when asked', () => {
    expect(formatDuration({ durationMs: 4_230, hasTenths: true })).toBe('4.2s');
    expect(formatDuration({ durationMs: 4_230 })).toBe('4s');
    expect(formatDuration({ durationMs: 12_400, hasTenths: true })).toBe('12s');
  });

  it('never goes negative when the clock is behind the start', () => {
    expect(formatDuration({ durationMs: -500 })).toBe('0ms');
    expect(formatDuration({ durationMs: -500, hasTenths: true })).toBe('0.0s');
  });
});
