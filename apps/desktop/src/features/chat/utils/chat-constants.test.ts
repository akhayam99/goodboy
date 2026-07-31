import { describe, expect, it } from 'vitest';
import { modelLabel } from './chat-constants';

describe('modelLabel', () => {
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
