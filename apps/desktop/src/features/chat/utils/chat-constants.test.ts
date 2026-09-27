import { describe, expect, it } from 'vitest';
import { modelLabel, suggestHeavierModel } from './chat-constants';

describe('modelLabel', () => {
  it('uses the authored Astra label for its catalog key and cli id', () => {
    expect(modelLabel('gpt-6')).toBe('Astra');
    expect(modelLabel('gpt-6-astra')).toBe('Astra');
  });

  it('leaves an unrecognized Astra effort suffix unchanged', () => {
    expect(modelLabel('gpt-6-astra-high')).toBe('gpt-6-astra-high');
  });

  it('leaves unknown gpt effort variants unchanged', () => {
    expect(modelLabel('gpt-5.6-high')).toBe('gpt-5.6-high');
  });

  it('leaves unknown gemini variants unchanged', () => {
    expect(modelLabel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  it('leaves an unknown vendor-prefixed id unchanged', () => {
    expect(modelLabel('mistral-large-2.1')).toBe('mistral-large-2.1');
  });
});

describe('suggestHeavierModel, price of the model actually running', () => {
  const CURSOR_CANDIDATES = ['auto', 'composer-2.5', 'sonnet-4.6', 'opus-5', 'gpt-5.6'];

  it('prices the step up from the combo that is running, not from its base', () => {
    const fromFast = suggestHeavierModel({
      provider: 'cursor',
      current: 'composer-2.5-fast',
      candidates: CURSOR_CANDIDATES,
    });
    const fromBase = suggestHeavierModel({
      provider: 'cursor',
      current: 'composer-2.5',
      candidates: CURSOR_CANDIDATES,
    });

    expect(fromFast?.id).toBe(fromBase?.id);
    expect(fromFast?.costMultiplier).toBeLessThan(fromBase?.costMultiplier ?? 0);
    expect(fromFast?.costMultiplier).toBeCloseTo(1.7, 5);
  });

  it('keeps the composer suggestion strong, so the multiplier stays out of the card', () => {
    expect(
      suggestHeavierModel({
        provider: 'cursor',
        current: 'composer-2.5-fast',
        candidates: CURSOR_CANDIDATES,
      })?.kind,
    ).toBe('strong');
  });
});

describe('suggestHeavierModel, price from the provider that runs the model', () => {
  it('prices a cursor step up from cursor rates, not from the codex table', () => {
    expect(
      suggestHeavierModel({
        provider: 'cursor',
        current: 'gpt-5.6-terra',
        candidates: ['gpt-5.6-terra', 'gpt-5.6'],
      }),
    ).toEqual({ id: 'gpt-5.6', kind: 'strong', costMultiplier: 2.5 });
  });
});
