import { describe, expect, it } from 'vitest';
import { chatModelId, chatModelKey, shownChatEffort } from './chatRouting';

describe('chatRouting', () => {
  it('round trips a catalog key through the picker model id', () => {
    const modelId = chatModelId({ provider: 'anthropic', model: 'sonnet-5' });
    expect(modelId).toBe('claude-sonnet-5');
    expect(chatModelKey({ provider: 'anthropic', modelId })).toBe('sonnet-5');
  });

  it('keeps an unknown id as it came', () => {
    expect(chatModelKey({ provider: 'anthropic', modelId: 'mystery-model' })).toBe('mystery-model');
  });

  it('shows the saved effort first and medium when nothing says otherwise', () => {
    expect(shownChatEffort({ provider: 'anthropic', model: 'sonnet-5', effort: 'high' })).toBe(
      'high',
    );
    expect(shownChatEffort({ provider: 'anthropic', model: 'sonnet-5', effort: null })).toBe(
      'medium',
    );
  });
});
