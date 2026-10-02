// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import {
  chatDefaultModelKey,
  parseChatDefaultModel,
  serializeChatDefaultModel,
} from './chatDefaultModelSetting';

describe('chatDefaultModelSetting', () => {
  it('keys the setting per workspace', () => {
    expect(chatDefaultModelKey({ workspaceId: 'ws-1' as WorkspaceId })).toBe(
      'chat.default_model.ws-1',
    );
  });

  it('round-trips a routing through the stored string', () => {
    const routing = { provider: 'anthropic', model: 'opus-5', effort: 'high' } as const;

    expect(parseChatDefaultModel({ raw: serializeChatDefaultModel({ routing }) })).toEqual(routing);
  });

  it('keeps a missing effort as null', () => {
    const raw = JSON.stringify({ provider: 'codex', model: 'gpt-5.6-sol' });

    expect(parseChatDefaultModel({ raw })).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: null,
    });
  });

  it.each([
    ['unset', null],
    ['unset in the store', undefined],
    ['cleared', ''],
    ['not json', '{oops'],
    ['not an object', '"sonnet-5"'],
    [
      'a provider chat refuses',
      JSON.stringify({ provider: 'cursor', model: 'auto', effort: null }),
    ],
    ['an unknown provider', JSON.stringify({ provider: 'nope', model: 'x', effort: null })],
    ['a model the catalog dropped', JSON.stringify({ provider: 'anthropic', model: 'gone-9' })],
    ['a model that is not a string', JSON.stringify({ provider: 'anthropic', model: 5 })],
  ])('reads %s as no default', (_label, raw) => {
    expect(parseChatDefaultModel({ raw })).toBeNull();
  });

  it('drops an effort that is not a level', () => {
    const raw = JSON.stringify({ provider: 'anthropic', model: 'sonnet-5', effort: 'turbo' });

    expect(parseChatDefaultModel({ raw })?.effort).toBeNull();
  });
});
