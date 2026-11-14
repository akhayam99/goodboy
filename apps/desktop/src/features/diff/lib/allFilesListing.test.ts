import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import type { ExploreEntry } from '../../explore/explore';
import type { ExploreListing } from '../../explore/exploreRows';
import { allFilesListingOf, folderSumsOf, matchingFilesOf } from './allFilesListing';
import { lineCountOf } from './lineCountOf';

const file = (path: string, additions: number, deletions: number, status: FileDiff['status']) =>
  ({ path, status, additions, deletions, binary: false, hunks: [] }) satisfies FileDiff;

const entry = (relPath: string, isDir: boolean): ExploreEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes: null,
  modifiedAt: null,
});

const FILES = [
  file('src/ledger.ts', 3, 1, 'modified'),
  file('src/old.ts', 0, 4, 'deleted'),
  file('gone/removed.ts', 0, 2, 'deleted'),
];

const LISTING: ExploreListing = {
  entriesByPath: {
    '': [entry('src', true), entry('docs', true)],
    src: [entry('src/ledger.ts', false), entry('src/index.ts', false)],
  },
  loadingByPath: {},
  errorByPath: {},
};

describe('allFilesListingOf', () => {
  it('adds a deleted file to the folder that still exists on disk', () => {
    const merged = allFilesListingOf({ files: FILES, listing: LISTING });

    expect(merged.entriesByPath['src']?.map((item) => item.relPath)).toEqual([
      'src/index.ts',
      'src/ledger.ts',
      'src/old.ts',
    ]);
  });

  it('adds a folder that exists only in the diff and lists its changed files', () => {
    const merged = allFilesListingOf({ files: FILES, listing: LISTING });

    expect(merged.entriesByPath['']?.map((item) => item.relPath)).toEqual(['docs', 'gone', 'src']);
    expect(merged.entriesByPath['gone']?.map((item) => item.relPath)).toEqual(['gone/removed.ts']);
  });

  it('leaves an unloaded folder unlisted so it loads when opened', () => {
    const merged = allFilesListingOf({ files: FILES, listing: LISTING });

    expect(merged.entriesByPath['docs']).toBeUndefined();
  });

  it('keeps the root unlisted until it has loaded', () => {
    const merged = allFilesListingOf({
      files: FILES,
      listing: { entriesByPath: {}, loadingByPath: { '': true }, errorByPath: {} },
    });

    expect(merged.entriesByPath['']).toBeUndefined();
  });
});

describe('folderSumsOf', () => {
  it('sums every ancestor folder of the changed files', () => {
    const sums = folderSumsOf({ files: FILES });

    expect(sums.get('src')).toEqual({ additions: 3, deletions: 5, count: 2 });
    expect(sums.get('gone')).toEqual({ additions: 0, deletions: 2, count: 1 });
  });
});

describe('matchingFilesOf', () => {
  it('finds loaded files by path and ignores folders', () => {
    expect(matchingFilesOf({ listing: LISTING, query: 'IND' }).map((item) => item.relPath)).toEqual(
      ['src/index.ts'],
    );
    expect(matchingFilesOf({ listing: LISTING, query: '  ' })).toEqual([]);
  });
});

describe('lineCountOf', () => {
  it('counts lines without the trailing newline', () => {
    expect(lineCountOf({ text: '' })).toBe(0);
    expect(lineCountOf({ text: 'a' })).toBe(1);
    expect(lineCountOf({ text: 'a\nb\n' })).toBe(2);
    expect(lineCountOf({ text: 'a\n\nb' })).toBe(3);
  });
});
