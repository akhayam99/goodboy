import { describe, expect, it } from 'vitest';
import { modelLabel } from './chat-constants';

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
