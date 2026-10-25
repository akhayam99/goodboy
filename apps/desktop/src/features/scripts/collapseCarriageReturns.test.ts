// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collapseCarriageReturns } from './collapseCarriageReturns';

describe('collapseCarriageReturns', () => {
  it('keeps text without a carriage return as it is', () => {
    expect(collapseCarriageReturns({ text: 'a\nb\n' })).toBe('a\nb\n');
  });

  it('keeps the last frame of a redrawn line', () => {
    expect(collapseCarriageReturns({ text: '10%\r50%\r100%\nready\n' })).toBe('100%\nready\n');
  });

  it('treats a carriage return before a newline as a plain line end', () => {
    expect(collapseCarriageReturns({ text: 'one\r\ntwo\r\n' })).toBe('one\ntwo\n');
  });

  it('keeps the open frame of the last line until the next chunk replaces it', () => {
    expect(collapseCarriageReturns({ text: 'a\n10%\r50%\r' })).toBe('a\n50%\r');
    expect(collapseCarriageReturns({ text: '50%\r70%\r' })).toBe('70%\r');
  });

  it('ignores frames that only erase the line', () => {
    expect(collapseCarriageReturns({ text: 'loading\r\u001B[2K\n' })).toBe('loading\n');
  });
});
