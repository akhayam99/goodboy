import { describe, expect, it } from 'vitest';
import { chatModelLabel } from './chatModelLabel';
import { isChatProviderRefused } from './chatProviders';
import { defaultChatModel } from './defaultChatModel';

describe('defaultChatModel', () => {
  it('prefers Sonnet 5 when Claude is connected', () => {
    expect(defaultChatModel({ connected: ['codex', 'anthropic'] })).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5',
    });
  });

  it('skips the providers a chat refuses', () => {
    const choice = defaultChatModel({ connected: ['opencode', 'codex'] });
    expect(choice.provider).toBe('codex');
    expect(isChatProviderRefused({ provider: 'opencode' })).toBe(true);
  });

  it('labels a model from its catalog', () => {
    expect(chatModelLabel({ provider: 'anthropic', model: 'sonnet-5' })).toBe('Sonnet 5');
    expect(chatModelLabel({ provider: 'anthropic', model: 'unknown-key' })).toBe('unknown-key');
  });
});
