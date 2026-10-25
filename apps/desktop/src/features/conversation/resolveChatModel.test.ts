// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveChatModel } from './resolveChatModel';

describe('resolveChatModel', () => {
  it('turns a claude model key into the cli id and its default effort', () => {
    expect(resolveChatModel({ provider: 'anthropic', modelKey: 'opus-5.5' })).toEqual({
      model: 'claude-opus-5-5',
      effort: 'high',
    });
  });

  it('reads the codex effort out of the reasoning config', () => {
    expect(resolveChatModel({ provider: 'codex', modelKey: 'gpt-5.6-sol' })).toEqual({
      model: 'gpt-5.6-sol',
      effort: 'low',
    });
  });

  it('refuses a key the catalog does not know', () => {
    expect(() => resolveChatModel({ provider: 'anthropic', modelKey: 'sonnet-0' })).toThrow(
      'unknown model key',
    );
  });
});
