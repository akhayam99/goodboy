import { describe, expect, it } from 'vitest';
import { resolveModelForProvider } from './model-map';

describe('resolveModelForProvider', () => {
  it('keeps current ids and migrates retired ids for the same provider', () => {
    expect(resolveModelForProvider({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' })).toBe(
      'sonnet-4.6',
    );
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'composer-2' })).toBe(
      'composer-2.5',
    );
  });

  it('keeps a shared key and otherwise uses the target tier default', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'claude-sonnet-4-6' })).toBe(
      'sonnet-4.6',
    );
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'claude-opus-4-8' })).toBe(
      'composer-2.5',
    );
  });

  it('maps cursor slugs through their catalog keys', () => {
    expect(
      resolveModelForProvider({
        provider: 'anthropic',
        modelId: 'claude-4.6-sonnet-medium',
      }),
    ).toBe('sonnet-4.6');
    expect(
      resolveModelForProvider({
        provider: 'anthropic',
        modelId: 'claude-opus-4-7-thinking-high',
      }),
    ).toBe('opus-4.7');
  });

  it('falls back to the target cheap-tier default when the key is unavailable', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'gpt-5.4-mini' })).toBe('auto');
  });

  it('falls back to the default turn model for an unknown id', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'totally-unknown-model' })).toBe(
      'composer-2.5',
    );
    expect(
      resolveModelForProvider({ provider: 'anthropic', modelId: 'totally-unknown-model' }),
    ).toBe('opus-5');
  });

  it('falls back to the target model of the same tier', () => {
    expect(resolveModelForProvider({ provider: 'anthropic', modelId: 'auto' })).toBe('haiku-4.5');
  });
});
