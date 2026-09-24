import { describe, expect, it } from 'vitest';
import { escapeControlCharsInStrings } from './escapeControlCharsInStrings';

describe('escapeControlCharsInStrings', () => {
  it('escapes raw control characters inside a string value', () => {
    const escaped = escapeControlCharsInStrings({ value: '{"text":"a\nb\tc\rd"}' });

    expect(JSON.parse(escaped)).toEqual({ text: 'a\nb\tc\rd' });
  });

  it('leaves whitespace between tokens alone', () => {
    const value = '{\n  "a": 1,\n\t"b": "x"\n}';

    expect(escapeControlCharsInStrings({ value })).toBe(value);
  });

  it('keeps an escaped quote inside the string it belongs to', () => {
    const escaped = escapeControlCharsInStrings({ value: '{"text":"say \\"hi\\"\nnow"}' });

    expect(JSON.parse(escaped)).toEqual({ text: 'say "hi"\nnow' });
  });
});
