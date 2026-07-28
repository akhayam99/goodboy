import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { CURSOR_CHEAP_MODEL, computeCursorCostUsd, cursorPriceFor } from './cost';
import { computeCostUsd } from '../claude/cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('computeCursorCostUsd', () => {
  it('composer-2-fast (cheap default) uses Composer-tier pricing', () => {
    expect(computeCursorCostUsd(usage, CURSOR_CHEAP_MODEL)).toBeCloseTo(0.8 + 4);
  });

  it('claude-4.6-sonnet-medium matches anthropic sonnet list price', () => {
    const cursorCost = computeCursorCostUsd(usage, 'claude-4.6-sonnet-medium');
    const claudeCost = computeCostUsd(usage, 'claude-sonnet-4-6');
    expect(cursorCost).toBeCloseTo(claudeCost);
  });

  it('claude-opus-4-7-thinking-high uses opus-tier pricing', () => {
    expect(computeCursorCostUsd(usage, 'claude-opus-4-7-thinking-high')).toBeCloseTo(15 + 75);
  });

  it('gpt-5.5-high uses GPT-5 pricing proxy', () => {
    expect(computeCursorCostUsd(usage, 'gpt-5.5-high')).toBeCloseTo(5 + 15);
  });

  it('unknown model falls back to composer-2-fast pricing', () => {
    expect(computeCursorCostUsd(usage, 'mystery-model-9')).toBeCloseTo(
      computeCursorCostUsd(usage, CURSOR_CHEAP_MODEL),
    );
  });

  it('cached tokens are billed at discounted rate', () => {
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCursorCostUsd(partial, 'claude-4.6-sonnet-medium')).toBeCloseTo(3 + 0.3);
  });

  it('cursorPriceFor returns composer-2-fast fallback for unknown model', () => {
    const p = cursorPriceFor('totally-unknown');
    const fallback = cursorPriceFor(CURSOR_CHEAP_MODEL);
    expect(p).toEqual(fallback);
  });
});
