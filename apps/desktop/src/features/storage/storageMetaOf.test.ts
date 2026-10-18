import { describe, expect, it } from 'vitest';
import { storageMetaOf } from './storageMetaOf';

const GB = 1024 ** 3;

describe('storageMetaOf', () => {
  it('reads the total on this Mac for every workspace', () => {
    expect(
      storageMetaOf({
        totalBytes: 5.9 * GB,
        workspaceName: null,
        isAllScope: true,
        freeBytes: 61 * GB,
      }),
    ).toBe('5.9 GB on this Mac');
  });

  it('names the workspace when the scope is one workspace', () => {
    expect(
      storageMetaOf({
        totalBytes: 2.1 * GB,
        workspaceName: 'Harborline',
        isAllScope: false,
        freeBytes: null,
      }),
    ).toBe('2.1 GB in Harborline');
  });

  it('adds the low space warning under 10 GB free', () => {
    expect(
      storageMetaOf({
        totalBytes: 5.9 * GB,
        workspaceName: null,
        isAllScope: true,
        freeBytes: 8 * GB,
      }),
    ).toBe('5.9 GB on this Mac · Low space: 8.0 GB free on this disk');
  });
});
