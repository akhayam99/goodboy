import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd } from './format-cost';

describe('formatTokens', () => {
  it('formats token counts across unit boundaries', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(50000)).toBe('50.0k');
    expect(formatTokens(1_500_000)).toBe('1.50M');
  });
});

describe('formatUsd', () => {
  it('formats values across precision boundaries', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.005)).toBe('<$0.01');
    expect(formatUsd(0.5)).toBe('$0.500');
    expect(formatUsd(12.3)).toBe('$12.30');
  });
});
