import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeCursorCostUsd, cursorPriceFor, CURSOR_PRICES } from './cost';
import { computeCostUsd } from '../claude/cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('computeCursorCostUsd', () => {
  it('composer-2.5-fast uses fast pricing', () => {
    expect(computeCursorCostUsd({ usage, model: 'composer-2.5-fast' })).toBeCloseTo(3 + 15);
  });

  it('claude-4.6-sonnet-medium matches anthropic sonnet list price', () => {
    const cursorCost = computeCursorCostUsd({
      usage,
      model: 'claude-4.6-sonnet-medium',
    });
    const claudeCost = computeCostUsd({ usage, model: 'claude-sonnet-4-6' });
    expect(cursorCost).toBeCloseTo(claudeCost);
  });

  it('claude-opus-4-7-thinking-high uses opus-tier pricing', () => {
    expect(computeCursorCostUsd({ usage, model: 'claude-opus-4-7-thinking-high' })).toBeCloseTo(
      5 + 25,
    );
  });

  it('gpt-5.5-high uses GPT-5 pricing proxy', () => {
    expect(computeCursorCostUsd({ usage, model: 'gpt-5.5-high' })).toBeCloseTo(5 + 30);
  });

  it('unknown model costs at least as much as every known model', () => {
    const unknown = computeCursorCostUsd({ usage, model: 'mystery-model-9' });
    for (const model of Object.keys(CURSOR_PRICES)) {
      expect(unknown).toBeGreaterThanOrEqual(computeCursorCostUsd({ usage, model }));
    }
    expect(unknown).toBeGreaterThan(computeCursorCostUsd({ usage, model: 'composer-2.5' }));
  });

  it('cached tokens are billed at discounted rate', () => {
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCursorCostUsd({ usage: partial, model: 'claude-4.6-sonnet-medium' })).toBeCloseTo(
      6 + 0.3,
    );
  });

  it('bills cache creation at 1.25 times the input rate', () => {
    const cacheCreationUsage: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 180_000,
      estimatedCostUsd: 0,
    };

    expect(
      computeCursorCostUsd({
        usage: cacheCreationUsage,
        model: 'claude-opus-5-thinking-high',
      }),
    ).toBeCloseTo(1.125);
  });

  it('cursorPriceFor falls back to the most expensive rate on every axis', () => {
    const fallback = cursorPriceFor('totally-unknown');
    const known = Object.values(CURSOR_PRICES);
    expect(fallback.inputPerMtok).toBe(Math.max(...known.map((p) => p.inputPerMtok)));
    expect(fallback.outputPerMtok).toBe(Math.max(...known.map((p) => p.outputPerMtok)));
    expect(fallback.cachedInputPerMtok).toBe(Math.max(...known.map((p) => p.cachedInputPerMtok)));
  });
});
