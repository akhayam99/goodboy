import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from './catalogs';
import { getModelPrice, getProviderModelPrice } from './model-price';

describe('getModelPrice', () => {
  it('returns claude opus pricing for a known opus id', () => {
    expect(getModelPrice('claude-opus-5')).toEqual({ inputPerMtok: 5, outputPerMtok: 25 });
    expect(getModelPrice('claude-opus-4-8')).toEqual({ inputPerMtok: 5, outputPerMtok: 25 });
  });

  it('returns claude fable pricing for the most expensive id', () => {
    expect(getModelPrice('claude-fable-5')).toEqual({ inputPerMtok: 10, outputPerMtok: 50 });
  });

  it('returns claude sonnet pricing', () => {
    expect(getModelPrice('claude-sonnet-4-6')).toEqual({ inputPerMtok: 3, outputPerMtok: 15 });
  });

  it('returns dedicated claude sonnet-5 pricing', () => {
    expect(getModelPrice('claude-sonnet-5')).toEqual({ inputPerMtok: 2, outputPerMtok: 10 });
  });

  it('returns claude haiku pricing', () => {
    expect(getModelPrice('claude-haiku-4-5')).toEqual({ inputPerMtok: 1, outputPerMtok: 5 });
  });

  it('returns cursor composer pricing for a known cursor id', () => {
    expect(getModelPrice('composer-2.5-fast')).toEqual({ inputPerMtok: 3, outputPerMtok: 15 });
  });

  it('omits the cached-input rate from the summary', () => {
    const price = getModelPrice('claude-opus-4-8');
    expect(price).not.toHaveProperty('cachedInputPerMtok');
  });

  it('returns codex pricing for catalog cli ids', () => {
    expect(getModelPrice('gpt-6-astra')).toEqual({ inputPerMtok: 10, outputPerMtok: 50 });
    expect(getModelPrice('gpt-5.5')).toEqual({ inputPerMtok: 5, outputPerMtok: 30 });
    expect(getModelPrice('gpt-5.4-mini')).toEqual({ inputPerMtok: 0.75, outputPerMtok: 4.5 });
  });

  it('returns gemini pricing for catalog cli ids', () => {
    expect(getModelPrice('gemini-3.1-pro')).toEqual({ inputPerMtok: 2, outputPerMtok: 12 });
  });

  it('returns null for an unknown model with no fallback', () => {
    expect(getModelPrice('claude-vapor-9-9')).toBeNull();
  });

  it('returns cursor composer pricing for composer-2.5 (no effort suffix)', () => {
    expect(getModelPrice('composer-2.5')).toEqual({ inputPerMtok: 0.5, outputPerMtok: 2.5 });
  });

  it('returns cursor gpt pricing for gpt-5.5-high', () => {
    expect(getModelPrice('gpt-5.5-high')).toEqual({ inputPerMtok: 5, outputPerMtok: 30 });
  });

  it('returns cursor sonnet pricing for claude-4.6-sonnet-medium', () => {
    expect(getModelPrice('claude-4.6-sonnet-medium')).toEqual({
      inputPerMtok: 3,
      outputPerMtok: 15,
    });
  });

  it('returns codex gpt-5.4 pricing', () => {
    expect(getModelPrice('gpt-5.4')).toEqual({ inputPerMtok: 2.5, outputPerMtok: 15 });
  });

  it.each([
    ['gpt-6', 'gpt-6-astra'],
    ['gpt-5.6', 'gpt-5.6-sol'],
    ['opus-5', 'claude-opus-5'],
    ['sonnet-4.6', 'claude-sonnet-4-6'],
    ['composer-2.5', 'composer-2.5'],
  ])('maps catalog key %s to its default cli price', (key, cliId) => {
    expect(getModelPrice(key)).not.toBeNull();
    expect(getModelPrice(key)).toEqual(getModelPrice(cliId));
  });
});

describe('getProviderModelPrice', () => {
  it('returns each provider own price for the same model id', () => {
    expect(getProviderModelPrice({ provider: 'anthropic', model: 'sonnet-4.5' })).toEqual({
      inputPerMtok: 3,
      outputPerMtok: 15,
    });
    expect(getProviderModelPrice({ provider: 'openrouter', model: 'sonnet-4.5' })).toBeNull();
    expect(getProviderModelPrice({ provider: 'gemini', model: 'gemini-3.1-pro' })).toEqual({
      inputPerMtok: 2,
      outputPerMtok: 12,
    });
    expect(getProviderModelPrice({ provider: 'openrouter', model: 'gemini-3.1-pro' })).toBeNull();
  });

  it('never fills a gap from another provider rate', () => {
    expect(getProviderModelPrice({ provider: 'openrouter', model: 'opus-4.8' })).toBeNull();
    expect(getProviderModelPrice({ provider: 'anthropic', model: 'opus-4.8' })).toEqual({
      inputPerMtok: 5,
      outputPerMtok: 25,
    });
  });

  it('returns null and never zero for an unknown price', () => {
    expect(getProviderModelPrice({ provider: 'anthropic', model: 'claude-vapor-9-9' })).toBeNull();
    expect(getProviderModelPrice({ provider: 'codex', model: 'gpt-9' })).toBeNull();
    expect(getProviderModelPrice({ provider: 'cursor', model: 'nope' })).toBeNull();
  });

  it('returns null for subscription routes with no per-token billing', () => {
    for (const model of MODEL_CATALOGS.opencode) {
      expect(getProviderModelPrice({ provider: 'opencode', model: model.key })).toBeNull();
    }
    expect(getProviderModelPrice({ provider: 'moonshot', model: 'kimi-k3' })).toBeNull();
  });

  it('resolves a catalog key through its own provider native id', () => {
    expect(getProviderModelPrice({ provider: 'codex', model: 'gpt-6' })).toEqual({
      inputPerMtok: 10,
      outputPerMtok: 50,
    });
    expect(getProviderModelPrice({ provider: 'cursor', model: 'composer-2.5' })).toEqual({
      inputPerMtok: 0.5,
      outputPerMtok: 2.5,
    });
  });
});
