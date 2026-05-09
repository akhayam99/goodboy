import { describe, expect, it } from 'vitest';
import { formatCost, formatTokens, shortModel } from '../agentRowFormat';

describe('formatTokens', () => {
  it('renders raw count under 1k', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(42)).toBe('42');
    expect(formatTokens(999)).toBe('999');
  });

  it('renders 1-decimal k under 100k', () => {
    expect(formatTokens(1_000)).toBe('1.0k');
    expect(formatTokens(12_345)).toBe('12.3k');
    expect(formatTokens(99_999)).toBe('100.0k');
  });

  it('renders integer k at or above 100k', () => {
    expect(formatTokens(100_000)).toBe('100k');
    expect(formatTokens(1_234_567)).toBe('1235k');
  });
});

describe('formatCost', () => {
  it('shows $0 for zero', () => {
    expect(formatCost(0)).toBe('$0');
  });

  it('shows <$0.01 below the cent', () => {
    expect(formatCost(0.0001)).toBe('<$0.01');
    expect(formatCost(0.0099)).toBe('<$0.01');
  });

  it('shows 3 decimals between 1 cent and 1 dollar', () => {
    expect(formatCost(0.012)).toBe('$0.012');
    expect(formatCost(0.999)).toBe('$0.999');
  });

  it('shows 2 decimals at or above 1 dollar', () => {
    expect(formatCost(1)).toBe('$1.00');
    expect(formatCost(12.345)).toBe('$12.35');
  });
});

describe('shortModel', () => {
  it('extracts the family from a versioned claude model', () => {
    expect(shortModel('claude-haiku-4-5')).toBe('haiku');
    expect(shortModel('claude-sonnet-4-6')).toBe('sonnet');
    expect(shortModel('claude-opus-4-7')).toBe('opus');
  });

  it('passes non-claude models through', () => {
    expect(shortModel('gpt-5.1')).toBe('gpt-5.1');
    expect(shortModel('cursor-fast')).toBe('cursor-fast');
  });

  it('handles uppercase family in claude id', () => {
    expect(shortModel('CLAUDE-HAIKU-4-5')).toBe('haiku');
  });
});
