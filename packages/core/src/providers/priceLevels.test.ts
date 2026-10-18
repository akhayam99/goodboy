import { describe, expect, it } from 'vitest';
import type { ProviderUsage, RequestUsage } from '@goodboy/types';
import { computeCodexCostUsd } from './codex/cost';
import { computeGeminiCostUsd } from './gemini/cost';
import { costCoverage } from './cost-coverage';

const request = (overrides: Partial<RequestUsage>): RequestUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  ...overrides,
});

const turnOf = (large: RequestUsage): ProviderUsage => ({
  ...large,
  largeRequests: [large],
  estimatedCostUsd: 0,
});

describe('price levels', () => {
  it('codex bills a request above 272k prompt tokens at the long rate', () => {
    const large = request({ inputTokens: 300_000, outputTokens: 100_000 });
    expect(computeCodexCostUsd({ usage: turnOf(large), model: 'gpt-6.1-sol' })).toBeCloseTo(
      (300_000 * 4 + 100_000 * 15) / 1_000_000,
    );
  });

  it('codex keeps the lower rate at exactly 272k prompt tokens', () => {
    const large = request({ inputTokens: 272_000 });
    expect(computeCodexCostUsd({ usage: turnOf(large), model: 'gpt-6.1-sol' })).toBeCloseTo(
      (272_000 * 2) / 1_000_000,
    );
  });

  it('codex scales the cache rate with the input rate when the level lists none', () => {
    const large = request({ inputTokens: 400_000, cachedInputTokens: 300_000 });
    expect(computeCodexCostUsd({ usage: turnOf(large), model: 'gpt-6-luna' })).toBeCloseTo(
      (100_000 * 0.2 + 300_000 * 0.02) / 1_000_000,
    );
  });

  it('gemini bills a request above 200k prompt tokens at the long rate', () => {
    const large = request({ inputTokens: 250_000, outputTokens: 10_000 });
    expect(computeGeminiCostUsd({ usage: turnOf(large), model: 'gemini-3.1-pro' })).toBeCloseTo(
      (250_000 * 4 + 10_000 * 18) / 1_000_000,
    );
  });

  it('gemini keeps the lower rate when the turn carries no large request', () => {
    const usage: ProviderUsage = {
      inputTokens: 250_000,
      outputTokens: 10_000,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
    };
    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.1-pro' })).toBeCloseTo(
      (250_000 * 2 + 10_000 * 12) / 1_000_000,
    );
  });

  it('haiku 5.5 reads as measured now that both levels are billed', () => {
    expect(costCoverage({ provider: 'anthropic', model: 'claude-haiku-5-5' })).toBe('measured');
  });
});
