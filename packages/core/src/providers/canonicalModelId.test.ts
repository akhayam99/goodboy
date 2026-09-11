import { describe, expect, it } from 'vitest';
import { canonicalModelId } from './canonicalModelId';
import { resolveModelIdForProvider } from './resolveModelIdForProvider';

describe('canonicalModelId', () => {
  it('reads a cursor key and its base slug as the same execution', () => {
    expect(canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5' })).toBe(
      canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5' }),
    );
    expect(canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5' })).toBe('composer-2.5');
  });

  it('keeps the cursor fast combo apart from the base model', () => {
    expect(canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5-fast' })).toBe(
      'composer-2.5-fast',
    );
    expect(canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5-fast' })).not.toBe(
      canonicalModelId({ provider: 'cursor', modelId: 'composer-2.5' }),
    );
  });

  it('keeps the cursor thinking combo apart from the non thinking one', () => {
    expect(
      canonicalModelId({ provider: 'cursor', modelId: 'claude-4.6-sonnet-medium-thinking' }),
    ).toBe('claude-4.6-sonnet-medium-thinking');
    expect(
      canonicalModelId({ provider: 'cursor', modelId: 'claude-4.6-sonnet-medium-thinking' }),
    ).not.toBe(canonicalModelId({ provider: 'cursor', modelId: 'sonnet-4.6' }));
  });

  it('reads the codex astra key and its cli id as the same execution', () => {
    expect(canonicalModelId({ provider: 'codex', modelId: 'gpt-6' })).toBe(
      canonicalModelId({ provider: 'codex', modelId: 'gpt-6-astra' }),
    );
  });

  it('reads an anthropic key and its cli id as the same execution', () => {
    expect(canonicalModelId({ provider: 'anthropic', modelId: 'opus-5' })).toBe(
      canonicalModelId({ provider: 'anthropic', modelId: 'claude-opus-5' }),
    );
  });

  it('keeps sol, terra and luna independent', () => {
    const sol = canonicalModelId({ provider: 'codex', modelId: 'gpt-5.6-sol' });
    const terra = canonicalModelId({ provider: 'codex', modelId: 'gpt-5.6-terra' });
    const luna = canonicalModelId({ provider: 'codex', modelId: 'gpt-5.6-luna' });
    expect(new Set([sol, terra, luna]).size).toBe(3);
    expect(sol).toBe('gpt-5.6-sol');
    expect(luna).toBe('gpt-5.6-luna');
  });
});

describe('resolveModelIdForProvider', () => {
  it('returns the plain key when the model carries no axes', () => {
    expect(resolveModelIdForProvider({ provider: 'cursor', modelId: 'composer-2.5' })).toBe(
      'composer-2.5',
    );
    expect(resolveModelIdForProvider({ provider: 'anthropic', modelId: 'claude-opus-5' })).toBe(
      'opus-5',
    );
  });

  it('keeps the cursor combo when the id carries one', () => {
    expect(resolveModelIdForProvider({ provider: 'cursor', modelId: 'composer-2.5-fast' })).toBe(
      'composer-2.5-fast',
    );
    expect(
      resolveModelIdForProvider({
        provider: 'cursor',
        modelId: 'claude-4.6-sonnet-medium-thinking',
      }),
    ).toBe('claude-4.6-sonnet-medium-thinking');
  });

  it('still remaps an id that belongs to another provider', () => {
    expect(resolveModelIdForProvider({ provider: 'cursor', modelId: 'claude-sonnet-4-6' })).toBe(
      'sonnet-4.6',
    );
  });

  it('never reinterprets a collapsed id as a combo', () => {
    expect(resolveModelIdForProvider({ provider: 'cursor', modelId: 'composer-2.5' })).not.toBe(
      'composer-2.5-fast',
    );
  });
});
