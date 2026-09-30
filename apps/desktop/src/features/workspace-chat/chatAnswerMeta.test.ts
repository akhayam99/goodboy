import { describe, expect, it } from 'vitest';
import { chatAnswerMeta } from './chatAnswerMeta';

describe('chatAnswerMeta', () => {
  it('names the model and the effort that wrote the answer', () => {
    expect(
      chatAnswerMeta({ message: { provider: 'anthropic', model: 'sonnet-5', effort: 'xhigh' } }),
    ).toBe('Sonnet 5 · Very high');
  });

  it('drops the effort when the answer has none', () => {
    expect(
      chatAnswerMeta({ message: { provider: 'anthropic', model: 'sonnet-5', effort: null } }),
    ).toBe('Sonnet 5');
  });

  it('says nothing for a message without a model', () => {
    expect(chatAnswerMeta({ message: { provider: null, model: null, effort: null } })).toBeNull();
  });
});
