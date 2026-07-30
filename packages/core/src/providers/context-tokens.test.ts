import { describe, expect, it } from 'vitest';
import type { ProviderName } from '@goodboy/types';
import { contextTokensForUsage, inputTokensForUsage } from './context-tokens';

const EXCLUSIVE_INPUT_PROVIDERS = [
  'anthropic',
  'openai',
  'cursor',
  'opencode',
  'openrouter',
] satisfies ReadonlyArray<ProviderName>;

const INCLUSIVE_INPUT_PROVIDERS = ['codex', 'gemini'] satisfies ReadonlyArray<ProviderName>;

describe('contextTokensForUsage', () => {
  it.each(EXCLUSIVE_INPUT_PROVIDERS)('adds cache tokens for %s usage', (provider) => {
    expect(
      contextTokensForUsage({
        provider,
        inputTokens: 100,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
        outputTokens: 10,
      }),
    ).toBe(160);
  });

  it.each(INCLUSIVE_INPUT_PROVIDERS)(
    'does not double-count cache tokens for %s usage',
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
});

describe('inputTokensForUsage', () => {
  it.each(EXCLUSIVE_INPUT_PROVIDERS)('adds cache tokens for %s usage', (provider) => {
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
