import { describe, expect, it } from 'vitest';
import { shellQuote } from './shellQuote';

describe('shellQuote', () => {
  it('wraps a plain value in single quotes', () => {
    expect(shellQuote({ value: 'fix/ledger-postings' })).toBe("'fix/ledger-postings'");
  });

  it('keeps shell metacharacters inert', () => {
    expect(shellQuote({ value: 'a;rm -rf x' })).toBe("'a;rm -rf x'");
    expect(shellQuote({ value: '$(whoami)' })).toBe("'$(whoami)'");
  });

  it('escapes embedded single quotes', () => {
    expect(shellQuote({ value: "it's" })).toBe("'it'\\''s'");
  });
});
