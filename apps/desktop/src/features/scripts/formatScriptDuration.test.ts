import { describe, expect, it } from 'vitest';
import { formatScriptDuration } from './formatScriptDuration';

describe('formatScriptDuration', () => {
  it('shows tenths under ten seconds only when asked', () => {
    expect(formatScriptDuration({ durationMs: 4_230, hasTenths: true })).toBe('4.2s');
    expect(formatScriptDuration({ durationMs: 4_230 })).toBe('4s');
  });

  it('counts minutes and hours for long runs', () => {
    expect(formatScriptDuration({ durationMs: 12_400, hasTenths: true })).toBe('12s');
    expect(formatScriptDuration({ durationMs: 72_000 })).toBe('1m 12s');
    expect(formatScriptDuration({ durationMs: 3_900_000 })).toBe('1h 5m');
  });

  it('never goes negative when the clock is behind the start', () => {
    expect(formatScriptDuration({ durationMs: -500 })).toBe('0s');
  });
});
