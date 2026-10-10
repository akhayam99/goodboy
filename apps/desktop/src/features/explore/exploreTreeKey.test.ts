// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ExploreEntry } from './explore';
import { flattenExploreRows } from './exploreRows';
import { exploreTreeKey, type ExploreKeyResult } from './exploreTreeKey';

const AT = '2026-09-14T15:40:00Z';

const dir = (relPath: string): ExploreEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir: true,
  sizeBytes: 0,
  modifiedAt: AT,
});

const file = (relPath: string): ExploreEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir: false,
  sizeBytes: 10,
  modifiedAt: AT,
});

const LISTING = {
  entriesByPath: {
    '': [dir('apps'), dir('docs'), file('package.json')],
    apps: [dir('apps/ledger-core'), file('apps/readme.md')],
    'apps/ledger-core': [file('apps/ledger-core/rounding.ts')],
    docs: [],
  },
  loadingByPath: {},
  errorByPath: {},
};

const rowsWith = (expanded: Record<string, boolean>) =>
  flattenExploreRows({ ...LISTING, expanded });

const FOCUS = (id: string): ExploreKeyResult => ({ kind: 'focus', id });
const NONE: ExploreKeyResult = { kind: 'none' };

const CLOSED = rowsWith({});
const OPEN = rowsWith({ apps: true, 'apps/ledger-core': true, docs: true });

type Case = {
  readonly name: string;
  readonly rows: ReturnType<typeof rowsWith>;
  readonly activeId: string | null;
  readonly key: string;
  readonly expected: ExploreKeyResult;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'Down goes to the next row',
    rows: CLOSED,
    activeId: 'apps',
    key: 'ArrowDown',
    expected: FOCUS('docs'),
  },
  {
    name: 'Down stops on the last row',
    rows: CLOSED,
    activeId: 'package.json',
    key: 'ArrowDown',
    expected: NONE,
  },
  {
    name: 'Up goes to the previous row',
    rows: CLOSED,
    activeId: 'docs',
    key: 'ArrowUp',
    expected: FOCUS('apps'),
  },
  {
    name: 'Up stops on the first row',
    rows: CLOSED,
    activeId: 'apps',
    key: 'ArrowUp',
    expected: NONE,
  },
  {
    name: 'Down enters an open folder',
    rows: OPEN,
    activeId: 'apps',
    key: 'ArrowDown',
    expected: FOCUS('apps/ledger-core'),
  },
  {
    name: 'Down skips the empty row of an open folder',
    rows: OPEN,
    activeId: 'docs',
    key: 'ArrowDown',
    expected: FOCUS('package.json'),
  },
  {
    name: 'Home goes to the first row',
    rows: OPEN,
    activeId: 'package.json',
    key: 'Home',
    expected: FOCUS('apps'),
  },
  {
    name: 'End goes to the last row',
    rows: OPEN,
    activeId: 'apps',
    key: 'End',
    expected: FOCUS('package.json'),
  },
  {
    name: 'Right opens a closed folder',
    rows: CLOSED,
    activeId: 'apps',
    key: 'ArrowRight',
    expected: { kind: 'setExpanded', path: 'apps', isExpanded: true },
  },
  {
    name: 'Right enters an open folder',
    rows: OPEN,
    activeId: 'apps',
    key: 'ArrowRight',
    expected: FOCUS('apps/ledger-core'),
  },
  {
    name: 'Right does nothing in an open empty folder',
    rows: OPEN,
    activeId: 'docs',
    key: 'ArrowRight',
    expected: NONE,
  },
  {
    name: 'Right does nothing on a file',
    rows: CLOSED,
    activeId: 'package.json',
    key: 'ArrowRight',
    expected: NONE,
  },
  {
    name: 'Left closes an open folder',
    rows: OPEN,
    activeId: 'apps',
    key: 'ArrowLeft',
    expected: { kind: 'setExpanded', path: 'apps', isExpanded: false },
  },
  {
    name: 'Left goes from a file to its folder',
    rows: OPEN,
    activeId: 'apps/ledger-core/rounding.ts',
    key: 'ArrowLeft',
    expected: FOCUS('apps/ledger-core'),
  },
  {
    name: 'Left goes from a closed folder to its parent',
    rows: rowsWith({ apps: true }),
    activeId: 'apps/ledger-core',
    key: 'ArrowLeft',
    expected: FOCUS('apps'),
  },
  {
    name: 'Left does nothing on a root file',
    rows: CLOSED,
    activeId: 'package.json',
    key: 'ArrowLeft',
    expected: NONE,
  },
  {
    name: 'Enter activates the row',
    rows: CLOSED,
    activeId: 'package.json',
    key: 'Enter',
    expected: { kind: 'activate', id: 'package.json' },
  },
  {
    name: 'Space activates the row',
    rows: CLOSED,
    activeId: 'apps',
    key: ' ',
    expected: { kind: 'activate', id: 'apps' },
  },
  {
    name: 'Down with no active row lands on the first',
    rows: CLOSED,
    activeId: null,
    key: 'ArrowDown',
    expected: FOCUS('apps'),
  },
  {
    name: 'Right with no active row does nothing',
    rows: CLOSED,
    activeId: null,
    key: 'ArrowRight',
    expected: NONE,
  },
  {
    name: 'a stale active row falls back to the first',
    rows: CLOSED,
    activeId: 'gone',
    key: 'ArrowUp',
    expected: FOCUS('apps'),
  },
  { name: 'a letter does nothing', rows: CLOSED, activeId: 'apps', key: 'a', expected: NONE },
  { name: 'no rows, no move', rows: [], activeId: null, key: 'ArrowDown', expected: NONE },
];

describe('exploreTreeKey', () => {
  it.each(CASES)('$name', ({ rows, activeId, key, expected }) => {
    expect(exploreTreeKey({ rows, activeId, key })).toEqual(expected);
  });
});
