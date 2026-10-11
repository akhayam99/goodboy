import { describe, expect, it } from 'vitest';
import type { ChangedEntry } from '../worktree/worktree';
import {
  buildExploreChanges,
  changedExpandedOf,
  changedListingOf,
  NO_EXPLORE_CHANGES,
} from './exploreChanges';

const modified = (path: string): ChangedEntry => ({ path, status: 'modified', from: null });

const EMPTY_LISTING = { entriesByPath: {}, loadingByPath: {}, errorByPath: {} };

describe('buildExploreChanges', () => {
  it('counts a change once and once per folder above it', () => {
    const changes = buildExploreChanges({
      entries: [modified('src/a/x.ts'), modified('src/a/y.ts'), modified('src/z.ts')],
    });

    expect(changes.count).toBe(3);
    expect(changes.countByFolder.get('src')).toBe(3);
    expect(changes.countByFolder.get('src/a')).toBe(2);
    expect(changes.countByFolder.has('src/a/x.ts')).toBe(false);
  });

  it('drops a duplicate path and reads an empty list as nothing', () => {
    expect(buildExploreChanges({ entries: [modified('a.ts'), modified('a.ts')] }).count).toBe(1);
    expect(buildExploreChanges({ entries: [] })).toEqual(NO_EXPLORE_CHANGES);
  });
});

describe('changedListingOf', () => {
  it('lists the changed paths under their folders, folders first', () => {
    const changes = buildExploreChanges({
      entries: [modified('b.ts'), modified('src/a.ts'), modified('src/deep/c.ts')],
    });

    const listing = changedListingOf({ changes, listing: EMPTY_LISTING });

    expect((listing.entriesByPath[''] ?? []).map((entry) => entry.name)).toEqual(['src', 'b.ts']);
    expect((listing.entriesByPath['src'] ?? []).map((entry) => entry.name)).toEqual([
      'deep',
      'a.ts',
    ]);
    expect((listing.entriesByPath['src/deep'] ?? []).map((entry) => entry.name)).toEqual(['c.ts']);
  });

  it('keeps the size and the age the folder listing already knew', () => {
    const changes = buildExploreChanges({ entries: [modified('a.ts')] });
    const known = {
      name: 'a.ts',
      relPath: 'a.ts',
      isDir: false,
      sizeBytes: 77,
      modifiedAt: '2026-09-14T15:40:00Z',
    };

    const listing = changedListingOf({
      changes,
      listing: { ...EMPTY_LISTING, entriesByPath: { '': [known] } },
    });

    expect(listing.entriesByPath['']?.[0]).toEqual(known);
  });

  it('opens every folder unless the person closed it', () => {
    const changes = buildExploreChanges({ entries: [modified('src/deep/c.ts')] });
    const listing = changedListingOf({ changes, listing: EMPTY_LISTING });

    expect(changedExpandedOf({ listing, collapsed: { 'src/deep': true } })).toEqual({
      src: true,
      'src/deep': false,
    });
  });
});
