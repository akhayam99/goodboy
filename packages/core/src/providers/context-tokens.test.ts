import { describe, expect, it } from 'vitest';
import type { ProviderName } from '@goodboy/types';
import { contextTokensForUsage, inputTokensForUsage } from './context-tokens';

const UNKNOWN_LEGACY_PROVIDERS = [
  'anthropic',
  'openai',
  'cursor',
  'opencode',
  'openrouter',
] satisfies ReadonlyArray<ProviderName>;

const INCLUSIVE_INPUT_PROVIDERS = ['codex', 'gemini'] satisfies ReadonlyArray<ProviderName>;

type UsageRecord = {
  readonly provider: ProviderName;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly outputTokens: number;
  readonly contextTokens?: number;
};

describe('contextTokensForUsage', () => {
  it('passes through finite context tokens from a full usage record', () => {
    const usage: UsageRecord = {
      provider: 'anthropic',
      inputTokens: 100,
      cachedInputTokens: 20,
      cacheCreationInputTokens: 30,
      outputTokens: 10,
      contextTokens: 42,
    };
    expect(contextTokensForUsage(usage)).toBe(42);
  });

  it.each([...UNKNOWN_LEGACY_PROVIDERS, ...INCLUSIVE_INPUT_PROVIDERS])(
    'never passes turn totals off as the context for %s usage',
    (provider) => {
      const usage: UsageRecord = {
        provider,
        inputTokens: 2_750_000,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
        outputTokens: 42_700,
      };
      expect(contextTokensForUsage(usage)).toBeNull();
    },
  );

  it('reads non-finite context tokens as unknown', () => {
    expect(contextTokensForUsage({ contextTokens: Number.NaN })).toBeNull();
  });
});

describe('inputTokensForUsage', () => {
  it.each(UNKNOWN_LEGACY_PROVIDERS)('adds cache tokens for %s usage', (provider) => {
    expect(
      inputTokensForUsage({
        provider,
        inputTokens: 100,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
      }),
    ).toBe(150);
  });

  it.each(INCLUSIVE_INPUT_PROVIDERS)(
    'does not double-count cache tokens for %s usage',
    (provider) => {
      expect(
        inputTokensForUsage({
          provider,
          inputTokens: 100,
          cachedInputTokens: 20,
          cacheCreationInputTokens: 30,
        }),
      ).toBe(100);
    },
  );
});
