import { describe, expect, it } from 'vitest';
import { contextWindowFor } from './contextWindowFor';

describe('contextWindowFor', () => {
  it('resolves cursor and codex cli slugs through the model catalog', () => {
    expect(
      contextWindowFor({
        provider: 'cursor',
        model: 'claude-4.6-sonnet-medium-thinking',
      }),
    ).toBe(1_000_000);
    expect(contextWindowFor({ provider: 'cursor', model: 'composer-2.5' })).toBe(200_000);
    expect(contextWindowFor({ provider: 'codex', model: 'gpt-5.4-mini' })).toBe(400_000);
  });

  it('returns null instead of a provider fallback for unknown ids', () => {
    expect(contextWindowFor({ provider: 'anthropic', model: 'unknown-model' })).toBeNull();
  });
});
