import { describe, expect, it, vi } from 'vitest';
import {
  CITED_PATH_LIMITS,
  citedPathHeader,
  extractCitedPaths,
  isCitedPathMajorityVerified,
  verifyCitedPaths,
} from './citedPaths';

describe('extractCitedPaths', () => {
  it('takes the trailing path of every claim line', () => {
    const text = [
      'the batch list already renders the totals apps/web/src/Batches.tsx',
      'the row component owns the status chip `apps/web/src/BatchRow.tsx`',
      'a line with no path at all',
      'the same file again apps/web/src/Batches.tsx',
    ].join('\n');
    expect(extractCitedPaths({ text })).toEqual([
      'apps/web/src/Batches.tsx',
      'apps/web/src/BatchRow.tsx',
    ]);
  });

  it('refuses urls, absolute paths and traversal', () => {
    const text = [
      'see https://example.com/a/b',
      'the system file /etc/hosts',
      'a climb out ../../secrets/key.pem',
    ].join('\n');
    expect(extractCitedPaths({ text })).toEqual([]);
  });

  it('caps the paths it will look at', () => {
    const text = Array.from({ length: 80 }, (_, index) => `claim apps/web/src/f${index}.ts`).join(
      '\n',
    );
    expect(extractCitedPaths({ text })).toHaveLength(CITED_PATH_LIMITS.paths);
  });
});

describe('verifyCitedPaths', () => {
  it('lists distinct parent directories rather than reading each file', async () => {
    const list = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'apps/web/src'
        ? [{ name: 'Batches.tsx' }, { name: 'BatchRow.tsx' }]
        : [{ name: 'store.ts' }],
    );
    const verification = await verifyCitedPaths({
      paths: ['apps/web/src/Batches.tsx', 'apps/web/src/BatchRow.tsx', 'apps/web/store/store.ts'],
      list,
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(verification.verified).toHaveLength(3);
    expect(verification.missing).toEqual([]);
  });

  it('counts a path the directory does not hold as missing', async () => {
    const list = vi.fn(async () => [{ name: 'Batches.tsx' }]);
    const verification = await verifyCitedPaths({
      paths: ['apps/web/src/Batches.tsx', 'apps/web/src/Ghost.tsx'],
      list,
    });
    expect(verification.verified).toEqual(['apps/web/src/Batches.tsx']);
    expect(verification.missing).toEqual(['apps/web/src/Ghost.tsx']);
  });

  it('counts a failed listing as unverified, never as false', async () => {
    const list = vi.fn(async () => {
      throw new Error('gone');
    });
    const verification = await verifyCitedPaths({ paths: ['apps/web/src/Batches.tsx'], list });
    expect(verification.missing).toEqual([]);
    expect(verification.unverified).toEqual(['apps/web/src/Batches.tsx']);
  });

  it('stops listing directories at the cap and leaves the rest unverified', async () => {
    const paths = Array.from({ length: 30 }, (_, index) => `apps/web/d${index}/file.ts`);
    const list = vi.fn(async () => [{ name: 'file.ts' }]);
    const verification = await verifyCitedPaths({ paths, list });
    expect(list).toHaveBeenCalledTimes(CITED_PATH_LIMITS.directories);
    expect(verification.verified).toHaveLength(CITED_PATH_LIMITS.directories);
    expect(verification.unverified).toHaveLength(30 - CITED_PATH_LIMITS.directories);
  });

  it('stops when the overall budget runs out', async () => {
    const paths = Array.from({ length: 5 }, (_, index) => `apps/web/d${index}/file.ts`);
    let clock = 0;
    const now = () => {
      clock += CITED_PATH_LIMITS.budgetMs;
      return clock;
    };
    const list = vi.fn(async () => [{ name: 'file.ts' }]);
    const verification = await verifyCitedPaths({ paths, list, now });
    expect(list).not.toHaveBeenCalled();
    expect(verification.unverified).toHaveLength(5);
  });
});

describe('citedPathHeader', () => {
  it('states the count and names the missing paths', () => {
    expect(
      citedPathHeader({
        verification: {
          cited: 3,
          verified: ['a/b.ts'],
          missing: ['a/c.ts', 'a/d.ts'],
          unverified: [],
        },
      }),
    ).toBe('verified 1 of 3 cited paths; missing: a/c.ts, a/d.ts');
  });

  it('drops the missing clause when nothing is missing', () => {
    expect(
      citedPathHeader({
        verification: { cited: 2, verified: ['a/b.ts', 'a/c.ts'], missing: [], unverified: [] },
      }),
    ).toBe('verified 2 of 2 cited paths');
  });
});

describe('isCitedPathMajorityVerified', () => {
  it('holds at exactly half', () => {
    expect(
      isCitedPathMajorityVerified({
        verification: { cited: 4, verified: ['a', 'b'], missing: ['c', 'd'], unverified: [] },
      }),
    ).toBe(true);
  });

  it('fails below half', () => {
    expect(
      isCitedPathMajorityVerified({
        verification: { cited: 5, verified: ['a', 'b'], missing: ['c', 'd', 'e'], unverified: [] },
      }),
    ).toBe(false);
  });

  it('treats a report that cited nothing as passing', () => {
    expect(
      isCitedPathMajorityVerified({
        verification: { cited: 0, verified: [], missing: [], unverified: [] },
      }),
    ).toBe(true);
  });
});

describe('verifyCitedPaths with known paths', () => {
  it('verifies a path the diff deleted without listing its directory', async () => {
    const listed: Array<string> = [];
    const verification = await verifyCitedPaths({
      paths: ['apps/web/src/Gone.tsx'],
      knownPaths: ['apps/web/src/Gone.tsx'],
      list: async ({ relPath }) => {
        listed.push(relPath);
        return [];
      },
    });
    expect(verification).toEqual({
      cited: 1,
      verified: ['apps/web/src/Gone.tsx'],
      missing: [],
      unverified: [],
    });
    expect(listed).toEqual([]);
  });

  it('still calls out a path that is neither on disk nor in the diff', async () => {
    const verification = await verifyCitedPaths({
      paths: ['apps/web/src/Gone.tsx', 'apps/web/src/Invented.tsx'],
      knownPaths: ['apps/web/src/Gone.tsx'],
      list: async () => [],
    });
    expect(verification.verified).toEqual(['apps/web/src/Gone.tsx']);
    expect(verification.missing).toEqual(['apps/web/src/Invented.tsx']);
  });
});
