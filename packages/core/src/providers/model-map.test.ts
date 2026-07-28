import { describe, expect, it } from 'vitest';
import { resolveModelForProvider } from './model-map';

describe('resolveModelForProvider', () => {
  it('returns the model unchanged when it belongs to the provider', () => {
    expect(resolveModelForProvider({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' })).toBe(
      'claude-sonnet-4-6',
    );
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'composer-2.5' })).toBe(
      'composer-2.5',
    );
  });

  it('maps a native claude id to the closest cursor slug', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'claude-sonnet-4-6' })).toBe(
      'claude-4.6-sonnet-medium',
    );
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'claude-opus-4-8' })).toBe(
      'claude-opus-4-7-thinking-high',
    );
  });

  it('maps a cursor slug back to the closest native id', () => {
    expect(
      resolveModelForProvider({
        provider: 'anthropic',
        modelId: 'claude-4.6-sonnet-medium',
      }),
    ).toBe('claude-sonnet-4-6');
    expect(
      resolveModelForProvider({
        provider: 'anthropic',
        modelId: 'claude-opus-4-7-thinking-high',
      }),
    ).toBe('claude-opus-4-8');
  });

  it('falls back to the family match when no subfamily counterpart exists', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'gpt-5.4-mini' })).toBe(
      'gpt-5.3-codex',
    );
  });

  it('falls back to the default turn model for an unknown id', () => {
    expect(resolveModelForProvider({ provider: 'cursor', modelId: 'totally-unknown-model' })).toBe(
      'composer-2.5',
    );
    expect(
      resolveModelForProvider({ provider: 'anthropic', modelId: 'totally-unknown-model' }),
    ).toBe('claude-opus-5');
  });

  it('falls back to the default turn model when the family has no counterpart', () => {
    expect(resolveModelForProvider({ provider: 'anthropic', modelId: 'auto' })).toBe(
      'claude-opus-5',
    );
  });
});
