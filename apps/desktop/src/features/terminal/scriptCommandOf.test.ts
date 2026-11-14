import { describe, expect, it } from 'vitest';
import { scriptCommandOf } from './scriptCommandOf';

describe('scriptCommandOf', () => {
  it('types the invocation and presses Enter', () => {
    expect(scriptCommandOf({ script: { invocation: 'pnpm dev', relDir: '' } })).toBe('pnpm dev\r');
  });

  it('enters the package folder first', () => {
    expect(
      scriptCommandOf({ script: { invocation: 'pnpm test', relDir: 'packages/ledger-core' } }),
    ).toBe("cd 'packages/ledger-core' && pnpm test\r");
  });

  it('quotes a folder with an apostrophe', () => {
    expect(scriptCommandOf({ script: { invocation: 'make', relDir: "it's" } })).toBe(
      "cd 'it'\\''s' && make\r",
    );
  });
});
