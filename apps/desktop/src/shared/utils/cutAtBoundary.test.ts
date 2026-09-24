import { describe, expect, it } from 'vitest';
import { cutAtBoundary } from './cutAtBoundary';

describe('cutAtBoundary', () => {
  it('keeps text at or under the cap untouched', () => {
    expect(cutAtBoundary({ text: 'short', capChars: 5 })).toEqual({
      text: 'short',
      omittedChars: 0,
    });
  });

  it('cuts at the last paragraph break before the cap', () => {
    const text = `${'a'.repeat(30)}\n\n${'b'.repeat(30)}\n\n${'c'.repeat(30)}`;
    const cut = cutAtBoundary({ text, capChars: 70 });
    expect(cut.text).toBe(`${'a'.repeat(30)}\n\n${'b'.repeat(30)}`);
    expect(cut.omittedChars).toBe(text.length - cut.text.length);
  });

  it('falls back to a line break, then a sentence end', () => {
    const lines = `${'a'.repeat(30)}\n${'b'.repeat(30)}\n${'c'.repeat(30)}`;
    expect(cutAtBoundary({ text: lines, capChars: 70 }).text).toBe(
      `${'a'.repeat(30)}\n${'b'.repeat(30)}`,
    );
    const sentences = 'The promo field is empty. The user taps Pay. The request returns 422 today.';
    expect(cutAtBoundary({ text: sentences, capChars: 60 }).text).toBe(
      'The promo field is empty. The user taps Pay.',
    );
  });

  it('cuts at a word and marks the cut when no sentence ends in reach', () => {
    const cut = cutAtBoundary({ text: 'one two three four five six', capChars: 16 });
    expect(cut.text).toBe('one two three…');
  });

  it('closes a code fence the cut leaves open', () => {
    const text = [
      'Steps:',
      '',
      '```ts',
      'applyPromo(code);',
      'render(error);',
      '```',
      '',
      'Tail',
    ].join('\n');
    const cut = cutAtBoundary({ text, capChars: 40 });
    expect(cut.text).toBe(['Steps:', '', '```ts', 'applyPromo(code);', '```'].join('\n'));
    expect(cut.omittedChars).toBeGreaterThan(0);
  });

  it('never cuts mid word on unbroken text past the cap', () => {
    const cut = cutAtBoundary({ text: 'x'.repeat(50), capChars: 20 });
    expect(cut.text).toBe(`${'x'.repeat(20)}…`);
    expect(cut.omittedChars).toBe(30);
  });
});
