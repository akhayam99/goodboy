import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@kay-am/types';
import { CURSOR_CHEAP_MODEL, computeCursorCostUsd, cursorPriceFor } from './cost';
import { computeCostUsd } from '../claude/cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('computeCursorCostUsd', () => {
  it('cursor-small uses haiku-tier proxy pricing', () => {
    // 1M input @ $0.8 + 1M output @ $4
    expect(computeCursorCostUsd(usage, CURSOR_CHEAP_MODEL)).toBeCloseTo(0.8 + 4);
  });

  it('claude-sonnet-4-5 matches anthropic list price', () => {
    const cursorCost = computeCursorCostUsd(usage, 'claude-sonnet-4-5');
    const claudeCost = computeCostUsd(usage, 'claude-sonnet-4-6');
    // both are sonnet-tier at $3/$15 — should match
    expect(cursorCost).toBeCloseTo(claudeCost);
  });

  it('claude-sonnet-4-6 matches anthropic list price', () => {
    const cursorCost = computeCursorCostUsd(usage, 'claude-sonnet-4-6');
    const claudeCost = computeCostUsd(usage, 'claude-sonnet-4-6');
    expect(cursorCost).toBeCloseTo(claudeCost);
  });

  it('gpt-4o uses documented pricing', () => {
    // 1M input @ $5 + 1M output @ $15
    expect(computeCursorCostUsd(usage, 'gpt-4o')).toBeCloseTo(5 + 15);
  });

  it('unknown model falls back to cursor-small pricing', () => {
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
    // claude-sonnet-4-5: 1M billable @ $3 + 1M cached @ $0.3
    expect(computeCursorCostUsd(partial, 'claude-sonnet-4-5')).toBeCloseTo(3 + 0.3);
  });

  it('cursorPriceFor returns cursor-small for unknown model', () => {
    const p = cursorPriceFor('totally-unknown');
    const fallback = cursorPriceFor(CURSOR_CHEAP_MODEL);
    expect(p).toEqual(fallback);
  });
});
