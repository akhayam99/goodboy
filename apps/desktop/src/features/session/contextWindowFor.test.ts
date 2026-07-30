import { describe, expect, it } from 'vitest';
import { contextWindowFor } from './contextWindowFor';

describe('contextWindowFor', () => {
  it('resolves cursor and codex cli slugs through the model catalog', () => {
    expect(contextWindowFor('claude-4.6-sonnet-medium-thinking')).toBe(1_000_000);
    expect(contextWindowFor('composer-2.5')).toBe(200_000);
    expect(contextWindowFor('gpt-5.4-mini')).toBe(400_000);
    expect(contextWindowFor('claude-opus-4-6')).toBe(200_000);
  });

  it('returns null instead of a provider fallback for unknown ids', () => {
    expect(contextWindowFor('unknown-model')).toBeNull();
  });
});
