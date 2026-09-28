import { describe, expect, it } from 'vitest';
import { chatWorkingFolder } from './chatWorkingFolder';

describe('chatWorkingFolder', () => {
  it('runs in the first project and reads the others as extra roots, never a shared parent', () => {
    expect(
      chatWorkingFolder({
        roots: [
          '/Users/mara/code/harborline/payments-api',
          '/Users/mara/code/harborline/ledger-core/',
          '/Users/mara/code/harborline/payments-api/packages/web',
        ],
      }),
    ).toEqual({
      workingDir: '/Users/mara/code/harborline/payments-api',
      readRoots: ['/Users/mara/code/harborline/ledger-core'],
    });
  });

  it('skips the filesystem root and relative paths', () => {
    expect(
      chatWorkingFolder({ roots: ['/', 'code/ledger-core', '/Users/mara/code/storefront-web'] }),
    ).toEqual({ workingDir: '/Users/mara/code/storefront-web', readRoots: [] });
  });

  it('has no folder for a workspace without projects', () => {
    expect(chatWorkingFolder({ roots: [] })).toBeNull();
    expect(chatWorkingFolder({ roots: ['  ', '/'] })).toBeNull();
  });
});
