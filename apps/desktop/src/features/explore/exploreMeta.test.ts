import { describe, expect, it } from 'vitest';
import type { ExploreEntry } from './explore';
import { exploreMetaOf } from './exploreMeta';

type EntryParams = {
  readonly name: string;
  readonly isDir: boolean;
};

const entry = ({ name, isDir }: EntryParams): ExploreEntry => ({
  name,
  relPath: name,
  isDir,
  sizeBytes: isDir ? null : 20,
  modifiedAt: null,
});

const ROOT: ReadonlyArray<ExploreEntry> = [
  entry({ name: 'apps', isDir: true }),
  entry({ name: 'docs', isDir: true }),
  entry({ name: 'src', isDir: true }),
  entry({ name: 'README.md', isDir: false }),
  entry({ name: 'package.json', isDir: false }),
  entry({ name: 'pnpm-lock.yaml', isDir: false }),
  entry({ name: 'tsconfig.json', isDir: false }),
];

describe('exploreMetaOf', () => {
  it('counts the folders and files at the root', () => {
    expect(exploreMetaOf({ isChangedMode: false, entries: ROOT, changeCount: 0 })).toBe(
      '3 folders · 4 files',
    );
  });

  it('uses the singular and drops a count that is zero', () => {
    expect(
      exploreMetaOf({
        isChangedMode: false,
        entries: [entry({ name: 'docs', isDir: true })],
        changeCount: 0,
      }),
    ).toBe('1 folder');
    expect(
      exploreMetaOf({
        isChangedMode: false,
        entries: [entry({ name: 'README.md', isDir: false })],
        changeCount: 0,
      }),
    ).toBe('1 file');
  });

  it('says nothing before the root loads or when it is empty', () => {
    expect(exploreMetaOf({ isChangedMode: false, entries: undefined, changeCount: 0 })).toBeNull();
    expect(exploreMetaOf({ isChangedMode: false, entries: [], changeCount: 0 })).toBeNull();
  });

  it('counts the changed files in the Changed view, not the root', () => {
    expect(exploreMetaOf({ isChangedMode: true, entries: ROOT, changeCount: 7 })).toBe(
      '7 files changed',
    );
    expect(exploreMetaOf({ isChangedMode: true, entries: ROOT, changeCount: 1 })).toBe(
      '1 file changed',
    );
    expect(exploreMetaOf({ isChangedMode: true, entries: ROOT, changeCount: 0 })).toBeNull();
  });
});
