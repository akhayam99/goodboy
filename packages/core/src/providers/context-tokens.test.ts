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

describe('contextTokensForUsage', () => {
  it('passes through finite context tokens', () => {
    expect(
      contextTokensForUsage({
        provider: 'anthropic',
        inputTokens: 100,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
        outputTokens: 10,
        contextTokens: 42,
      }),
    ).toBe(42);
  });

  it.each(UNKNOWN_LEGACY_PROVIDERS)('returns null for legacy %s usage', (provider) => {
    expect(
      contextTokensForUsage({
        provider,
        inputTokens: 100,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
        outputTokens: 10,
      }),
    ).toBeNull();
  });

  it.each(INCLUSIVE_INPUT_PROVIDERS)(
    'falls back without double-counting cache tokens for legacy %s usage',
    (provider) => {
      expect(
        contextTokensForUsage({
          provider,
          inputTokens: 100,
          cachedInputTokens: 20,
          cacheCreationInputTokens: 30,
          outputTokens: 10,
        }),
      ).toBe(110);
    },
  );

  it('falls back for non-finite context tokens', () => {
    expect(
      contextTokensForUsage({
        provider: 'codex',
        inputTokens: 100,
        outputTokens: 10,
        contextTokens: Number.NaN,
      }),
    ).toBe(110);
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
