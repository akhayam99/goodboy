// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inlineMarkdownText } from '@goodboy/ui';
import { plainText } from './plainText';

describe('plainText code identifiers', () => {
  it.each([
    ['Open `__init__.py`', 'Open __init__.py'],
    ['Keep `**literal**` and `~~literal~~`', 'Keep **literal** and ~~literal~~'],
    ['**Read `__init__.py`**', 'Read __init__.py'],
    ['[Read `__init__.py`](https://example.com)', 'Read __init__.py'],
    ['Fix **the thing in `__init__.py`', 'Fix the thing in __init__.py'],
    ['`foo__bar` and __unfinished', 'foo__bar and unfinished'],
  ])('preserves code values in %s', (text, expected) => {
    expect(plainText({ text })).toBe(expected);
  });

  it.each([
    ['', ''],
    ['  **Harborline** and ~~Northwind~~  ', 'Harborline and Northwind'],
    ['rename foo__bar now', 'rename foo__bar now'],
    ['Fix **the thing', 'Fix the thing'],
    ['~~unfinished and `unfinished', 'unfinished and unfinished'],
    ['<<repo: ledger-core>> ![Acme](https://example.com/logo.png)', 'ledger-core Acme'],
  ])('still flattens display markdown in %s', (text, expected) => {
    expect(plainText({ text })).toBe(expected);
  });

  it('leaves unmatched text markers in the default inline text conversion', () => {
    expect(inlineMarkdownText({ text: 'Fix **the thing in `__init__.py`' })).toBe(
      'Fix **the thing in __init__.py',
    );
  });
});
