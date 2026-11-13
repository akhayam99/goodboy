import { describe, expect, it } from 'vitest';
import { fileHrefOf } from './fileHrefOf';

describe('fileHrefOf', () => {
  it('reads a relative path', () => {
    expect(fileHrefOf({ href: 'src/payout.ts' })).toEqual({ path: 'src/payout.ts', line: null });
  });

  it('reads the line from a fragment', () => {
    expect(fileHrefOf({ href: './src/payout.ts#L42' })).toEqual({
      path: './src/payout.ts',
      line: 42,
    });
    expect(fileHrefOf({ href: 'src/payout.ts#L42-L50' })?.line).toBe(42);
  });

  it('drops a query and decodes the path', () => {
    expect(fileHrefOf({ href: 'docs/net%20terms.md?plain=1' })).toEqual({
      path: 'docs/net terms.md',
      line: null,
    });
  });

  it('reads a file address', () => {
    expect(fileHrefOf({ href: 'file:///work/harborline/ledger-core/README.md' })).toEqual({
      path: '/work/harborline/ledger-core/README.md',
      line: null,
    });
  });

  it('leaves web addresses, other schemes, anchors and empty links alone', () => {
    expect(fileHrefOf({ href: 'https://docs.harborline.dev/tax' })).toBeNull();
    expect(fileHrefOf({ href: 'mailto:ops@harborline.dev' })).toBeNull();
    expect(fileHrefOf({ href: '//cdn.harborline.dev/a.js' })).toBeNull();
    expect(fileHrefOf({ href: '#heading' })).toBeNull();
    expect(fileHrefOf({ href: '' })).toBeNull();
  });
});
