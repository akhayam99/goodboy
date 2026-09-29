// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fallbackModeLine } from './fallbackModeLine';

describe('fallbackModeLine', () => {
  it('says which stricter mode runs when the provider cannot honor the asked one', () => {
    expect(fallbackModeLine({ provider: 'codex', mode: 'default' })).toBe(
      "Read only · Ask first isn't available on Codex",
    );
    expect(fallbackModeLine({ provider: 'cursor', mode: 'acceptEdits' })).toBe(
      "Read only · Edits allowed isn't available on Cursor",
    );
  });

  it('stays silent when the provider runs the mode, even partly', () => {
    expect(fallbackModeLine({ provider: 'anthropic', mode: 'default' })).toBeNull();
    expect(fallbackModeLine({ provider: 'codex', mode: 'bypassPermissions' })).toBeNull();
  });
});
