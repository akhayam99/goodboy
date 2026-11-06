import { describe, expect, it } from 'vitest';
import { plainText } from './plainText';

describe('plainText', () => {
  it('keeps a double underscore inside a word', () => {
    expect(plainText({ text: 'rename foo__bar now' })).toBe('rename foo__bar now');
  });

  it('strips a double underscore at word edges', () => {
    expect(plainText({ text: '__Fix__ the thing' })).toBe('Fix the thing');
  });

  it('strips a cut bold marker', () => {
    expect(plainText({ text: 'Fix **the thing' })).toBe('Fix the thing');
  });

  it('strips backticks and strikethrough markers', () => {
    expect(plainText({ text: '`ledger-core` ~~old~~' })).toBe('ledger-core old');
  });
});
