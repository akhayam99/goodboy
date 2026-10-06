// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hiddenModelNote } from './hiddenModelNote';

describe('hiddenModelNote', () => {
  it('says a pinned hidden model keeps running because of the pin', () => {
    expect(hiddenModelNote({ provider: 'anthropic', model: 'opus-5.5' })).toBe(
      'Opus 5.5 · hidden, still runs because you pinned it',
    );
  });
});
