import { describe, expect, it } from 'vitest';
import { getModelPrice } from './model-price';

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
