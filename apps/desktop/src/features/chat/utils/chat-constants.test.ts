import { describe, expect, it } from 'vitest';
import { modelLabel, suggestHeavierModel } from './chat-constants';

describe('modelLabel', () => {
  it('uses the authored Astra label for its catalog key and cli id', () => {
    expect(modelLabel('gpt-6')).toBe('Astra');
    expect(modelLabel('gpt-6-astra')).toBe('Astra');
  });

  it('formats an unrecognized Astra effort suffix as an unknown id', () => {
    expect(modelLabel('gpt-6-astra-high')).toBe('GPT 6 Astra High');
  });

  it('keeps the version number intact for gpt effort variants', () => {
    expect(modelLabel('gpt-5.6-high')).toBe('GPT 5.6 High');
  });

  it('keeps the version number intact for gemini variants', () => {
    expect(modelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
  });

  it('keeps the version number intact for an unknown vendor-prefixed id', () => {
    expect(modelLabel('mistral-large-2.1')).toBe('Mistral Large 2.1');
  });
});

describe('suggestHeavierModel, price of the model actually running', () => {
  const CURSOR_CANDIDATES = ['auto', 'composer-2.5', 'sonnet-4.6', 'opus-5', 'gpt-5.6'];

  it('prices the step up from the combo that is running, not from its base', () => {
    const fromFast = suggestHeavierModel('composer-2.5-fast', CURSOR_CANDIDATES);
    const fromBase = suggestHeavierModel('composer-2.5', CURSOR_CANDIDATES);

    expect(fromFast?.id).toBe(fromBase?.id);
    expect(fromFast?.costMultiplier).toBeLessThan(fromBase?.costMultiplier ?? 0);
    expect(fromFast?.costMultiplier).toBeCloseTo(1.7, 5);
  });

  it('keeps the composer suggestion strong, so the multiplier stays out of the card', () => {
    expect(suggestHeavierModel('composer-2.5-fast', CURSOR_CANDIDATES)?.kind).toBe('strong');
  });
});
