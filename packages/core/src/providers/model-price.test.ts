import { describe, expect, it } from 'vitest';
import { getModelPrice } from './model-price';

describe('getModelPrice', () => {
  it('returns claude opus pricing for a known opus id', () => {
    expect(getModelPrice('claude-opus-4-8')).toEqual({ inputPerMtok: 5, outputPerMtok: 25 });
  });

  it('returns claude fable pricing for the most expensive id', () => {
    expect(getModelPrice('claude-fable-5')).toEqual({ inputPerMtok: 10, outputPerMtok: 50 });
  });

  it('returns claude sonnet pricing', () => {
    expect(getModelPrice('claude-sonnet-4-6')).toEqual({ inputPerMtok: 3, outputPerMtok: 15 });
  });

  it('returns claude haiku pricing', () => {
    expect(getModelPrice('claude-haiku-4-5')).toEqual({ inputPerMtok: 1, outputPerMtok: 5 });
  });

  it('returns cursor composer pricing for a known cursor id', () => {
    expect(getModelPrice('composer-2-fast')).toEqual({ inputPerMtok: 0.8, outputPerMtok: 4 });
  });

  it('omits the cached-input rate from the summary', () => {
    const price = getModelPrice('claude-opus-4-8');
    expect(price).not.toHaveProperty('cachedInputPerMtok');
  });

  it('returns null for codex picker ids with no static price table', () => {
    expect(getModelPrice('gpt-5.5')).toBeNull();
    expect(getModelPrice('gpt-5.4-mini')).toBeNull();
  });

  it('returns null for gemini picker ids with no static price table', () => {
    expect(getModelPrice('gemini-3.1-pro')).toBeNull();
  });

  it('returns null for an unknown model with no fallback', () => {
    expect(getModelPrice('claude-vapor-9-9')).toBeNull();
  });

  it('returns cursor composer pricing for composer-2 (no effort suffix)', () => {
    expect(getModelPrice('composer-2')).toEqual({ inputPerMtok: 0.8, outputPerMtok: 4 });
  });

  it('returns cursor gpt pricing for gpt-5.5-high', () => {
    expect(getModelPrice('gpt-5.5-high')).toEqual({ inputPerMtok: 5, outputPerMtok: 15 });
  });

  it('returns cursor sonnet pricing for claude-4.6-sonnet-medium', () => {
    expect(getModelPrice('claude-4.6-sonnet-medium')).toEqual({
      inputPerMtok: 3,
      outputPerMtok: 15,
    });
  });

  it('returns null for gpt-5.4 (not in any static table)', () => {
    expect(getModelPrice('gpt-5.4')).toBeNull();
  });
});
