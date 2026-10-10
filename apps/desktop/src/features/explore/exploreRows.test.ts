// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ExploreEntry } from './explore';
import {
  EXPLORE_ROW_PX,
  ancestorPathsOf,
  entryRowsOf,
  exploreRowHeight,
  flattenExploreRows,
  pendingFoldersOf,
  type ExploreListing,
} from './exploreRows';
import { layoutRows, windowOf } from '../../shared/utils/windowRows';

const AT = '2026-09-14T15:40:00Z';

const dir = (relPath: string): ExploreEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir: true,
  sizeBytes: 0,
  modifiedAt: AT,
});

const file = (relPath: string, sizeBytes = 100): ExploreEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir: false,
  sizeBytes,
  modifiedAt: AT,
});

const NONE: Pick<ExploreListing, 'loadingByPath' | 'errorByPath'> = {
  loadingByPath: {},
  errorByPath: {},
};

const REPO: ExploreListing['entriesByPath'] = {
  '': [dir('apps'), dir('docs'), file('package.json')],
  apps: [dir('apps/ledger-core'), file('apps/readme.md')],
  'apps/ledger-core': [file('apps/ledger-core/rounding.ts')],
  docs: [],
};

const shape = (rows: ReturnType<typeof flattenExploreRows>) =>
  rows.map((row) => `${row.depth}:${row.kind === 'entry' ? row.entry.relPath : row.kind}`);

describe('flattenExploreRows', () => {
  it('lists only the root while nothing is expanded', () => {
    const rows = flattenExploreRows({ entriesByPath: REPO, ...NONE, expanded: {} });
    expect(shape(rows)).toEqual(['0:apps', '0:docs', '0:package.json']);
  });

  it('walks open folders depth first with the depth of each row', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { apps: true, 'apps/ledger-core': true },
    });
    expect(shape(rows)).toEqual([
      '0:apps',
      '1:apps/ledger-core',
      '2:apps/ledger-core/rounding.ts',
      '1:apps/readme.md',
      '0:docs',
      '0:package.json',
    ]);
  });

  it('marks which folders are open and names the parent of each row', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { apps: true },
    });
    const entries = entryRowsOf(rows);
    expect(entries.map((row) => [row.entry.relPath, row.isExpanded, row.parentPath])).toEqual([
      ['apps', true, ''],
      ['apps/ledger-core', false, 'apps'],
      ['apps/readme.md', false, 'apps'],
      ['docs', false, ''],
      ['package.json', false, ''],
    ]);
  });

  it('never opens a file, whatever the expansion map says', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { 'package.json': true },
    });
    expect(shape(rows)).toEqual(['0:apps', '0:docs', '0:package.json']);
  });

  it('ignores remembered folders that are not in any listing', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { 'gone/folder': true, apps: false },
    });
    expect(shape(rows)).toEqual(['0:apps', '0:docs', '0:package.json']);
  });

  it('shows an empty row under an empty open folder', () => {
    const rows = flattenExploreRows({ entriesByPath: REPO, ...NONE, expanded: { docs: true } });
    expect(shape(rows)).toEqual(['0:apps', '0:docs', '1:empty', '0:package.json']);
  });

  it('shows a loading row while a listing is on its way', () => {
    const rows = flattenExploreRows({
      entriesByPath: { '': REPO[''] ?? [] },
      loadingByPath: { apps: true },
      errorByPath: {},
      expanded: { apps: true },
    });
    expect(shape(rows)).toEqual(['0:apps', '1:loading', '0:docs', '0:package.json']);
    expect(pendingFoldersOf(rows)).toEqual([]);
  });

  it('keeps the old rows while a loaded folder reloads', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      loadingByPath: { apps: true },
      errorByPath: {},
      expanded: { apps: true },
    });
    expect(shape(rows)).toEqual([
      '0:apps',
      '1:apps/ledger-core',
      '1:apps/readme.md',
      '0:docs',
      '0:package.json',
    ]);
  });

  it('asks to load a remembered folder that was never listed', () => {
    const rows = flattenExploreRows({
      entriesByPath: { '': REPO[''] ?? [] },
      ...NONE,
      expanded: { apps: true, docs: true },
    });
    expect(shape(rows)).toEqual(['0:apps', '1:loading', '0:docs', '1:loading', '0:package.json']);
    expect(pendingFoldersOf(rows)).toEqual(['apps', 'docs']);
  });

  it('shows the error of a folder that could not be read, with its message', () => {
    const rows = flattenExploreRows({
      entriesByPath: { '': REPO[''] ?? [] },
      loadingByPath: {},
      errorByPath: { apps: 'permission denied' },
      expanded: { apps: true },
    });
    expect(shape(rows)).toEqual(['0:apps', '1:error', '0:docs', '0:package.json']);
    const error = rows.find((row) => row.kind === 'error');
    expect(error?.kind === 'error' ? error.message : null).toBe('permission denied');
    expect(pendingFoldersOf(rows)).toEqual([]);
  });

  it('puts the failure of an open or reveal right under its row', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { apps: true },
      failureByPath: {
        'apps/readme.md': { message: "Couldn't open readme.md", isEditorMissing: true },
        docs: null,
      },
    });
    expect(shape(rows)).toEqual([
      '0:apps',
      '1:apps/ledger-core',
      '1:apps/readme.md',
      '2:failure',
      '0:docs',
      '0:package.json',
    ]);
    const failure = rows.find((row) => row.kind === 'failure');
    expect(failure?.kind === 'failure' ? [failure.message, failure.isEditorMissing] : null).toEqual(
      ["Couldn't open readme.md", true],
    );
  });

  it('puts the failure of a folder before the rows inside it', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { apps: true },
      failureByPath: { apps: { message: "Couldn't open apps", isEditorMissing: false } },
    });
    expect(shape(rows).slice(0, 3)).toEqual(['0:apps', '1:failure', '1:apps/ledger-core']);
  });

  it('returns no rows for an empty root', () => {
    expect(flattenExploreRows({ entriesByPath: { '': [] }, ...NONE, expanded: {} })).toEqual([]);
    expect(flattenExploreRows({ entriesByPath: {}, ...NONE, expanded: {} })).toEqual([]);
  });

  it('gives every row an id that is unique in the tree', () => {
    const rows = flattenExploreRows({
      entriesByPath: REPO,
      ...NONE,
      expanded: { apps: true, docs: true, 'apps/ledger-core': true },
    });
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flattens 100000 entries in one pass and windows them to a screenful', () => {
    const many = Array.from({ length: 100_000 }, (_, index) => file(`f${index}.ts`));
    const rows = flattenExploreRows({ entriesByPath: { '': many }, ...NONE, expanded: {} });
    expect(rows).toHaveLength(100_000);
    const layout = layoutRows({ rows, heightOf: exploreRowHeight });
    const range = windowOf({
      layout,
      count: rows.length,
      scrollTop: 50_000 * EXPLORE_ROW_PX,
      viewport: 600,
    });
    expect(range.start).toBeGreaterThan(49_900);
    expect(range.end - range.start).toBeLessThan(40);
  });
});

describe('exploreRowHeight', () => {
  it('is the 40px row of the scale', () => {
    expect(EXPLORE_ROW_PX).toBe(40);
    expect(exploreRowHeight()).toBe(40);
  });
});

describe('ancestorPathsOf', () => {
  it('lists the folders above a path, nearest the root first', () => {
    expect(ancestorPathsOf({ relPath: 'apps/ledger-core/src/rounding.ts' })).toEqual([
      'apps',
      'apps/ledger-core',
      'apps/ledger-core/src',
    ]);
  });

  it('has none for a root entry or an empty path', () => {
    expect(ancestorPathsOf({ relPath: 'package.json' })).toEqual([]);
    expect(ancestorPathsOf({ relPath: '' })).toEqual([]);
  });
});
