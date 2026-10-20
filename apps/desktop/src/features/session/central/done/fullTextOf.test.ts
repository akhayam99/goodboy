// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fullTextOf } from './fullTextOf';

describe('fullTextOf', () => {
  it('keeps the whole summary when the title is only its first step', () => {
    const text = 'apply fix -> verify tsc -> lint -> ready for push';

    expect(fullTextOf({ text, title: 'apply fix' })).toBe(text);
  });

  it('is empty when the title already says it all', () => {
    expect(
      fullTextOf({ text: 'Wrote the retry tests', title: 'Wrote the retry tests' }),
    ).toBeNull();
  });

  it('never repeats raw JSON', () => {
    expect(fullTextOf({ text: '{"done":["a"]}', title: 'a' })).toBeNull();
    expect(fullTextOf({ text: null, title: 'a' })).toBeNull();
  });
});
