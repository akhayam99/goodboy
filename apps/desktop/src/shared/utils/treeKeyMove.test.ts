import { describe, expect, it } from 'vitest';
import { treeKeyMove, type TreeKeyMove, type TreeKeyRow } from './treeKeyMove';

const ROWS: ReadonlyArray<TreeKeyRow> = [
  { id: 'apps', parentId: null, isBranch: true, isOpen: true },
  { id: 'apps/web', parentId: 'apps', isBranch: true, isOpen: false },
  { id: 'apps/readme', parentId: 'apps', isBranch: false, isOpen: false },
  { id: 'docs', parentId: null, isBranch: true, isOpen: true },
  { id: 'docs/empty', parentId: 'docs', isBranch: true, isOpen: true },
  { id: 'notes', parentId: null, isBranch: false, isOpen: false },
];

type Case = {
  readonly name: string;
  readonly key: string;
  readonly activeId: string | null;
  readonly expected: TreeKeyMove | null;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'Home goes to the first row',
    key: 'Home',
    activeId: 'notes',
    expected: { kind: 'focus', id: 'apps' },
  },
  {
    name: 'Home works with nothing active',
    key: 'Home',
    activeId: null,
    expected: { kind: 'focus', id: 'apps' },
  },
  {
    name: 'End goes to the last row',
    key: 'End',
    activeId: 'apps',
    expected: { kind: 'focus', id: 'notes' },
  },
  {
    name: 'Down moves one row',
    key: 'ArrowDown',
    activeId: 'apps',
    expected: { kind: 'focus', id: 'apps/web' },
  },
  { name: 'Down stops at the last row', key: 'ArrowDown', activeId: 'notes', expected: null },
  {
    name: 'Up moves one row',
    key: 'ArrowUp',
    activeId: 'docs',
    expected: { kind: 'focus', id: 'apps/readme' },
  },
  { name: 'Up stops at the first row', key: 'ArrowUp', activeId: 'apps', expected: null },
  {
    name: 'an arrow with nothing active does nothing here',
    key: 'ArrowDown',
    activeId: null,
    expected: null,
  },
  {
    name: 'Right on a closed branch opens it',
    key: 'ArrowRight',
    activeId: 'apps/web',
    expected: { kind: 'open', id: 'apps/web' },
  },
  {
    name: 'Right on an open branch enters its first child',
    key: 'ArrowRight',
    activeId: 'apps',
    expected: { kind: 'focus', id: 'apps/web' },
  },
  {
    name: 'Right on an open branch without children stays',
    key: 'ArrowRight',
    activeId: 'docs/empty',
    expected: null,
  },
  { name: 'Right on a leaf does nothing', key: 'ArrowRight', activeId: 'notes', expected: null },
  {
    name: 'Left on an open branch closes it',
    key: 'ArrowLeft',
    activeId: 'apps',
    expected: { kind: 'close', id: 'apps' },
  },
  {
    name: 'Left on a closed branch goes to its parent',
    key: 'ArrowLeft',
    activeId: 'apps/web',
    expected: { kind: 'focus', id: 'apps' },
  },
  {
    name: 'Left on a leaf goes to its parent',
    key: 'ArrowLeft',
    activeId: 'apps/readme',
    expected: { kind: 'focus', id: 'apps' },
  },
  { name: 'Left on a root leaf does nothing', key: 'ArrowLeft', activeId: 'notes', expected: null },
  {
    name: 'Enter activates the row',
    key: 'Enter',
    activeId: 'apps/readme',
    expected: { kind: 'activate', id: 'apps/readme' },
  },
  {
    name: 'Space activates the row',
    key: ' ',
    activeId: 'apps',
    expected: { kind: 'activate', id: 'apps' },
  },
  { name: 'a stale active row does nothing', key: 'Enter', activeId: 'gone', expected: null },
  { name: 'a letter does nothing', key: 'a', activeId: 'apps', expected: null },
];

describe('treeKeyMove', () => {
  it.each(CASES)('$name', ({ key, activeId, expected }) => {
    expect(treeKeyMove({ key, rows: ROWS, activeId })).toEqual(expected);
  });

  it('does nothing for an empty tree', () => {
    expect(treeKeyMove({ key: 'Home', rows: [], activeId: null })).toBeNull();
    expect(treeKeyMove({ key: 'End', rows: [], activeId: null })).toBeNull();
    expect(treeKeyMove({ key: 'ArrowDown', rows: [], activeId: 'apps' })).toBeNull();
  });
});
