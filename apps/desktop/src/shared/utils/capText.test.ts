import { describe, expect, it } from 'vitest';
import { capText } from './capText';

describe('capText', () => {
  it('keeps text at or under the cap untouched', () => {
    expect(capText({ text: 'short', capChars: 5 })).toBe('short');
  });

  it('cuts at the cap, trims the trailing space and marks the cut', () => {
    expect(capText({ text: 'one two three', capChars: 8 })).toBe('one two…');
  });
});
