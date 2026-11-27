// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getDefaultTurnModel, latestInGroup } from '@goodboy/core/providers';
import { chatModelLabel } from '../workspace-chat/chatModelLabel';
import { defaultChatModel } from './defaultChatModel';

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
    const sols = latestInGroup({ provider: 'codex', group: 'GPT', checkpoint: 'Sol' });
    expect(sols.map((model) => model.key)).toContain(codex.model);
  });

  it('starts a Codex chat on GPT-6.1 Sol, never on a Sol newer than the turn default', () => {
    expect(defaultChatModel({ connected: ['codex'] }).model).toBe('gpt-6.1-sol');
    expect(getDefaultTurnModel({ id: 'codex' })).toBe('gpt-6.1-sol');
  });

  it('goes to an older Codex Sol when the turn default is hidden', () => {
    expect(
      defaultChatModel({ connected: ['codex'], hidden: { codex: ['gpt-6.1-sol'] } }).model,
    ).toBe('gpt-6-sol');
  });

  it('takes a newer Codex Sol before an older expensive one', () => {
    expect(
      defaultChatModel({
        connected: ['codex'],
        hidden: { codex: ['gpt-6.1-sol', 'gpt-6-sol'] },
      }),
    ).toEqual({ provider: 'codex', model: 'gpt-6.2-sol' });
  });

  it('starts on the workspace default provider when a chat can run on it', () => {
    expect(
      defaultChatModel({ connected: ['anthropic', 'codex'], workspaceDefaultProvider: 'codex' }),
    ).toEqual({ provider: 'codex', model: 'gpt-6.1-sol' });
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
    expect(defaultChatModel({ connected: ['cursor'] }).provider).toBe('anthropic');
  });

  it('labels a model from its catalog', () => {
    expect(chatModelLabel({ provider: 'anthropic', model: 'sonnet-5' })).toBe('Sonnet 5');
    expect(chatModelLabel({ provider: 'anthropic', model: 'unknown-key' })).toBe('Unknown Key');
  });

  it('never starts a chat on a hidden Sonnet, it takes the next visible one', () => {
    const newest = latestInGroup({ provider: 'anthropic', group: 'Sonnet' })[0];
    const choice = defaultChatModel({
      connected: ['anthropic'],
      hidden: { anthropic: [newest?.key ?? ''] },
    });

    expect(choice.provider).toBe('anthropic');
    expect(choice.model).not.toBe(newest?.key);
  });

  it('moves a chat to the next chat provider when every Sonnet is hidden', () => {
    const everySonnet = latestInGroup({ provider: 'anthropic', group: 'Sonnet' }).map(
      (model) => model.key,
    );

    expect(
      defaultChatModel({ connected: ['anthropic', 'codex'], hidden: { anthropic: everySonnet } })
        .provider,
    ).toBe('codex');
  });
});
