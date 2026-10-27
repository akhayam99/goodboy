import { treeKeyMove, type TreeKeyRow } from '../../shared/utils/treeKeyMove';
import { entryRowsOf, type ExploreEntryRow, type ExploreRow } from './exploreRows';

export type ExploreKeyResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'focus'; readonly id: string }
  | { readonly kind: 'setExpanded'; readonly path: string; readonly isExpanded: boolean }
  | { readonly kind: 'activate'; readonly id: string };

type Params = {
  readonly rows: ReadonlyArray<ExploreRow>;
  readonly activeId: string | null;
  readonly key: string;
};

const NONE: ExploreKeyResult = { kind: 'none' };

type FocusParams = {
  readonly row: ExploreEntryRow | undefined;
};

const focusOn = ({ row }: FocusParams): ExploreKeyResult =>
  row === undefined ? NONE : { kind: 'focus', id: row.id };

type KeyRowsParams = {
  readonly entries: ReadonlyArray<ExploreEntryRow>;
};

const keyRowsOf = ({ entries }: KeyRowsParams): ReadonlyArray<TreeKeyRow> => {
  const idByPath = new Map(entries.map((row) => [row.entry.relPath, row.id]));
  return entries.map((row) => ({
    id: row.id,
    parentId: idByPath.get(row.parentPath) ?? null,
    isBranch: row.entry.isDir,
    isOpen: row.isExpanded,
  }));
};

export const exploreTreeKey = ({ rows, activeId, key }: Params): ExploreKeyResult => {
  const entries = entryRowsOf(rows);
  if (entries.length === 0) {
    return NONE;
  }
  const hasActive = entries.some((row) => row.id === activeId);
  if (!hasActive && (key === 'ArrowDown' || key === 'ArrowUp')) {
    return focusOn({ row: entries[0] });
  }
  const move = treeKeyMove({ key, rows: keyRowsOf({ entries }), activeId });
  if (move === null) {
    return NONE;
  }
  const row = entries.find((candidate) => candidate.id === move.id);
  if (move.kind === 'focus') {
    return { kind: 'focus', id: move.id };
  }
  if (move.kind === 'activate') {
    return { kind: 'activate', id: move.id };
  }
  return row === undefined
    ? NONE
    : { kind: 'setExpanded', path: row.entry.relPath, isExpanded: move.kind === 'open' };
};
