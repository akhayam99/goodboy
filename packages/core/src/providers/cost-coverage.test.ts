import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { costCoverage } from './cost-coverage';
import { computeCostUsd } from './claude/cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('costCoverage', () => {
  it('reports anthropic as measured for a priced model', () => {
    expect(costCoverage({ provider: 'anthropic', model: 'claude-sonnet-4-6' })).toBe('measured');
    expect(costCoverage({ provider: 'anthropic', model: 'claude-fable-5' })).toBe('measured');
  });

  it('reports anthropic as approximate for a model priced only by the sonnet fallback', () => {
    expect(costCoverage({ provider: 'anthropic', model: 'some-future-model' })).toBe('approximate');
    expect(computeCostUsd({ usage, model: 'some-future-model' })).toBeCloseTo(
      computeCostUsd({ usage, model: 'claude-sonnet-4-6' }),
    );
    expect(computeCostUsd({ usage, model: 'some-future-model' })).not.toBeCloseTo(
      computeCostUsd({ usage, model: 'claude-fable-5' }),
    );
  });

  it('reports codex as measured for a priced model and unpriced otherwise', () => {
    expect(costCoverage({ provider: 'codex', model: 'gpt-5.6-sol' })).toBe('measured');
    expect(costCoverage({ provider: 'codex', model: 'unknown-codex-model' })).toBe('unpriced');
  });

  it('reports gemini as measured for a priced model and unpriced otherwise', () => {
    expect(costCoverage({ provider: 'gemini', model: 'gemini-3.1-pro' })).toBe('measured');
    expect(costCoverage({ provider: 'gemini', model: 'unknown-gemini-model' })).toBe('unpriced');
  });

  it('reports cursor as approximate regardless of model', () => {
    expect(costCoverage({ provider: 'cursor', model: 'composer-2.5' })).toBe('approximate');
    expect(costCoverage({ provider: 'cursor', model: 'totally-unknown' })).toBe('approximate');
  });

  it('reports opencode, openrouter and moonshot as unpriced regardless of model', () => {
    expect(costCoverage({ provider: 'opencode', model: 'big-pickle' })).toBe('unpriced');
    expect(costCoverage({ provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' })).toBe(
      'unpriced',
    );
    expect(costCoverage({ provider: 'moonshot', model: 'kimi-k3' })).toBe('unpriced');
  });

  it('reports openai as unpriced, matching the exhaustive ProviderName member with no price table', () => {
    expect(costCoverage({ provider: 'openai', model: 'gpt-anything' })).toBe('unpriced');
  });
});
