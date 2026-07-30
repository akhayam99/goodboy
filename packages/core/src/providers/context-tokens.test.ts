import { describe, expect, it } from 'vitest';
import type { ProviderName } from '@goodboy/types';
import { contextTokensForUsage } from './context-tokens';

const EXCLUSIVE_INPUT_PROVIDERS = [
  'anthropic',
  'cursor',
  'opencode',
  'openrouter',
] satisfies ReadonlyArray<ProviderName>;

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

  it.each(['codex', 'gemini'] satisfies ReadonlyArray<ProviderName>)(
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
