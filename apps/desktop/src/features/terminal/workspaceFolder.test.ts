import { describe, expect, it } from 'vitest';
import { workspaceFolder, type FolderRoot } from './workspaceFolder';

const HOME = '/Users/mock';

type RootsParams = {
  readonly parent: string;
  readonly count: number;
};

const rootsUnder = ({ parent, count }: RootsParams): ReadonlyArray<FolderRoot> =>
  Array.from({ length: count }, (_, index) => ({
    path: `${parent}/service-${index}`,
    isStarred: false,
  }));

describe('workspaceFolder', () => {
  it('uses the common parent of 21 roots under one folder', () => {
    const roots = rootsUnder({ parent: `${HOME}/work/harborline`, count: 21 });

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe(`${HOME}/work/harborline`);
  });

  it('uses the common parent of 4 roots under one folder', () => {
    const roots = rootsUnder({ parent: `${HOME}/work/northwind`, count: 4 });

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe(`${HOME}/work/northwind`);
  });

  it('falls back to the first starred root when the roots are unrelated', () => {
    const roots: ReadonlyArray<FolderRoot> = [
      { path: '/mock/acme/ledger-core', isStarred: false },
      { path: '/data/cascadia/payments-api', isStarred: true },
    ];

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe(
      '/data/cascadia/payments-api',
    );
  });

  it('falls back to the first root when nothing is starred', () => {
    const roots: ReadonlyArray<FolderRoot> = [
      { path: '/mock/acme/ledger-core', isStarred: false },
      { path: '/data/cascadia/payments-api', isStarred: false },
    ];

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe('/mock/acme/ledger-core');
  });

  it('refuses a common parent that is the home folder itself', () => {
    const roots: ReadonlyArray<FolderRoot> = [
      { path: `${HOME}/ledger-core`, isStarred: false },
      { path: `${HOME}/payments-api`, isStarred: true },
    ];

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe(`${HOME}/payments-api`);
  });

  it('refuses a common parent above the home folder', () => {
    const roots: ReadonlyArray<FolderRoot> = [
      { path: '/Users/other/ledger-core', isStarred: false },
      { path: `${HOME}/payments-api`, isStarred: false },
    ];

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe('/Users/other/ledger-core');
  });

  it('lets the override win over every rule', () => {
    const roots = rootsUnder({ parent: `${HOME}/work/harborline`, count: 4 });

    expect(workspaceFolder({ roots, home: HOME, override: '/mock/elsewhere' })).toBe(
      '/mock/elsewhere',
    );
  });

  it('ignores a blank override', () => {
    const roots = rootsUnder({ parent: `${HOME}/work/harborline`, count: 4 });

    expect(workspaceFolder({ roots, home: HOME, override: '   ' })).toBe(`${HOME}/work/harborline`);
  });

  it('returns null for a workspace with no project', () => {
    expect(workspaceFolder({ roots: [], home: HOME, override: null })).toBeNull();
  });

  it('keeps a long trailing separator run linear', () => {
    const roots: ReadonlyArray<FolderRoot> = [
      { path: `${HOME}/work/a${'/'.repeat(100_000)}`, isStarred: false },
    ];

    expect(workspaceFolder({ roots, home: HOME, override: null })).toBe(`${HOME}/work`);
  });
});
