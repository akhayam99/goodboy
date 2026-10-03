// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { latestInGroup } from '@goodboy/core';
import { chatModelLabel } from './chatModelLabel';
import { chatModelOf, defaultChatModel } from './defaultChatModel';

describe('defaultChatModel', () => {
  it('starts a chat on the newest Sonnet in the catalog when Claude is connected', () => {
    const newest = latestInGroup({ provider: 'anthropic', group: 'Sonnet' })[0];
    expect(defaultChatModel({ connected: ['codex', 'anthropic'] })).toEqual({
      provider: 'anthropic',
      model: newest?.key,
    });
    expect(newest?.legacy).toBeUndefined();
  });

  it('skips the providers a chat refuses', () => {
    expect(defaultChatModel({ connected: ['opencode', 'cursor', 'codex'] }).provider).toBe('codex');
  });

  it('keeps a Codex chat on the mid tier line, never on the expensive one', () => {
    const codex = defaultChatModel({ connected: ['codex'] });
    expect(codex.model).toBe(chatModelOf({ provider: 'codex' }));
    expect(codex.model).toBe(
      latestInGroup({ provider: 'codex', group: 'GPT', checkpoint: 'Terra' })[0]?.key,
    );
  });

  it('starts on the workspace default provider when a chat can run on it', () => {
    expect(
      defaultChatModel({ connected: ['anthropic', 'codex'], workspaceDefaultProvider: 'codex' }),
    ).toEqual({ provider: 'codex', model: chatModelOf({ provider: 'codex' }) });
  });

  it('never starts a chat on a Cursor default, it falls back to the Sonnet line', () => {
    const choice = defaultChatModel({
      connected: ['cursor', 'codex', 'anthropic'],
      workspaceDefaultProvider: 'cursor',
    });
    expect(choice.provider).toBe('anthropic');
    expect(choice.model).toBe(latestInGroup({ provider: 'anthropic', group: 'Sonnet' })[0]?.key);
  });

  it('skips a workspace default that is not connected', () => {
    expect(
      defaultChatModel({ connected: ['anthropic'], workspaceDefaultProvider: 'codex' }).provider,
    ).toBe('anthropic');
  });

  it('offers no chat model for a provider a chat refuses', () => {
    expect(chatModelOf({ provider: 'cursor' })).toBeNull();
  });

  it('labels a model from its catalog', () => {
    expect(chatModelLabel({ provider: 'anthropic', model: 'sonnet-5' })).toBe('Sonnet 5');
    expect(chatModelLabel({ provider: 'anthropic', model: 'unknown-key' })).toBe('unknown-key');
  });
});
