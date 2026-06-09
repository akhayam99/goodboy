import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeCodexCostUsd, type CodexModelPriceOverride } from './cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

const zeroUsage: ProviderUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

const override: CodexModelPriceOverride = {
  inputPerMtok: 5,
  outputPerMtok: 20,
  cachedInputPerMtok: 0.5,
};

describe('computeCodexCostUsd', () => {
  it('returns 0 when no override provided', () => {
    expect(computeCodexCostUsd(usage, 'codex-latest', null)).toBe(0);
  });

  it('returns 0 for zero usage with no override', () => {
    expect(computeCodexCostUsd(zeroUsage, 'codex-latest', null)).toBe(0);
  });

  it('computes cost when override present', () => {
    expect(computeCodexCostUsd(usage, 'codex-latest', override)).toBeCloseTo(5 + 20);
  });

  it('applies cached token discount when override includes cachedInputPerMtok', () => {
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCodexCostUsd(partial, 'codex-latest', override)).toBeCloseTo(5 + 0.5);
  });

  it('falls back to inputPerMtok for cached tokens when cachedInputPerMtok absent', () => {
    const noCache: CodexModelPriceOverride = { inputPerMtok: 4, outputPerMtok: 16 };
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCodexCostUsd(partial, 'codex-latest', noCache)).toBeCloseTo(4 + 4);
  });

  it('model arg is ignored when no override (always 0)', () => {
    expect(computeCodexCostUsd(usage, 'codex-mini', null)).toBe(0);
    expect(computeCodexCostUsd(usage, 'whatever', null)).toBe(0);
  });

  it('clamps negative token counts to 0', () => {
    const weirdUsage: ProviderUsage = {
      inputTokens: 500_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCodexCostUsd(weirdUsage, 'codex-latest', override)).toBeCloseTo(
      (1_000_000 * override.cachedInputPerMtok!) / 1_000_000,
    );
  });
});
