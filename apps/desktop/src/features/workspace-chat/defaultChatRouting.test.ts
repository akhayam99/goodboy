// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultChatRouting } from './defaultChatRouting';

describe('defaultChatRouting', () => {
  it('falls back to the automatic model when nothing is saved', () => {
    expect(defaultChatRouting({ connected: ['codex', 'anthropic'], saved: null })).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      effort: null,
    });
  });

  it('uses the saved model, with its effort, when its provider is connected', () => {
    const saved = { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' } as const;

    expect(defaultChatRouting({ connected: ['codex', 'anthropic'], saved })).toEqual(saved);
  });

  it('falls back to the automatic model when the saved provider is disconnected', () => {
    const saved = { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' } as const;

    expect(defaultChatRouting({ connected: ['anthropic'], saved })).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      effort: null,
    });
  });
});
